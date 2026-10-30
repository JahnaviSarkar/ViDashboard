import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { SearchRepository } from '../db/repositories/search.repository';
import { ProductRepository } from '../db/repositories/product.repository';
import { ProductAnalysisRepository } from '../db/repositories/product-analysis.repository';
import { SearchResultRepository } from '../db/repositories/search-result.repository';
import { SourceRunRepository } from '../db/repositories/source-run.repository';
import { enqueueSearchPipelineJob } from '../queue/boss';
import { getConfig } from '../config/env';
import { ValidationError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';

const searchRequestSchema = z
  .object({
    query: z.string().optional(),
    productUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
    sources: z.array(z.enum(['instagram', 'meta', 'tiktok'])).default(['instagram', 'meta']),
    minMatchThreshold: z.coerce.number().min(0).max(100).default(60),
    showPreviouslySeen: z.coerce.boolean().default(false),
  })
  .refine(
    (data) => Boolean(data.query && data.query.trim()) || Boolean(data.productUrl && data.productUrl.trim()),
    {
      message: 'Either query text or productUrl must be provided',
      path: ['query'],
    }
  );

export async function searchRoutes(app: FastifyInstance) {
  const searchRepo = new SearchRepository();
  const productRepo = new ProductRepository();
  const analysisRepo = new ProductAnalysisRepository();
  const resultRepo = new SearchResultRepository();
  const sourceRunRepo = new SourceRunRepository();
  const config = getConfig();

  // Ensure upload directory exists
  const uploadDir = path.resolve(process.cwd(), config.UPLOAD_DIR);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // 1. POST /api/search - Create discovery search and enqueue job
  app.post('/api/search', async (request: FastifyRequest, reply: FastifyReply) => {
    let queryText: string | undefined;
    let productUrl: string | undefined;
    let sources: Array<'instagram' | 'meta' | 'tiktok'> = ['instagram', 'meta'];
    let minMatchThreshold = 60;
    let uploadedImagePath: string | undefined;

    const isMultipart = request.isMultipart();

    if (isMultipart) {
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'file') {
          const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
          if (!allowedMimeTypes.includes(part.mimetype)) {
            throw new ValidationError(`Unsupported image type "${part.mimetype}". Allowed types: JPEG, PNG, WebP, GIF.`);
          }

          const fileExt = path.extname(part.filename) || '.jpg';
          const savedFilename = `upload_${Date.now()}_${randomUUID()}${fileExt}`;
          const filePath = path.join(uploadDir, savedFilename);

          await new Promise<void>((resolve, reject) => {
            const writeStream = fs.createWriteStream(filePath);
            part.file.pipe(writeStream);
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
          });

          uploadedImagePath = filePath;
        } else {
          // Form fields
          const fieldName = part.fieldname;
          const fieldValue = String(part.value);

          if (fieldName === 'query') queryText = fieldValue;
          else if (fieldName === 'productUrl') productUrl = fieldValue;
          else if (fieldName === 'minMatchThreshold') minMatchThreshold = parseInt(fieldValue, 10);
          else if (fieldName === 'sources') {
            try {
              sources = JSON.parse(fieldValue);
            } catch {
              sources = fieldValue.split(',').map((s) => s.trim()) as any;
            }
          }
        }
      }
    } else {
      // JSON body
      const parsed = searchRequestSchema.parse(request.body);
      queryText = parsed.query;
      productUrl = parsed.productUrl || undefined;
      sources = parsed.sources as any;
      minMatchThreshold = parsed.minMatchThreshold;
    }

    if (!queryText && !productUrl && !uploadedImagePath) {
      throw new ValidationError('A product name/query, product URL, or uploaded product image is required to start a search.');
    }

    // Determine input type
    let inputType: 'keyword' | 'product_url' | 'image_upload' = 'keyword';
    if (uploadedImagePath) {
      inputType = 'image_upload';
    } else if (productUrl) {
      inputType = 'product_url';
    }

    // Create search in DB
    const search = await searchRepo.create({
      inputType,
      queryText: queryText || null,
      productUrl: productUrl || null,
      uploadedImagePath: uploadedImagePath || null,
      selectedSources: sources,
      minMatchThreshold,
      mode: config.MODE === 'mock' ? 'mock' : 'live',
      status: 'pending',
    });

    // Enqueue background processing job
    try {
      await enqueueSearchPipelineJob({ searchId: search.id });
    } catch (err) {
      logger.error({ err, searchId: search.id }, 'Failed to enqueue search pipeline job');
    }

    // Return 202 Accepted with search ID immediately
    return reply.status(202).send({
      searchId: search.id,
      status: 'pending',
      inputType: search.inputType,
      mode: search.mode,
      createdAt: search.createdAt,
    });
  });

  // 2. GET /api/search/:id - Status, resolved product, analysis and results
  app.get<{ Params: { id: string } }>('/api/search/:id', async (request, reply) => {
    const searchId = request.params.id;
    const search = await searchRepo.getById(searchId);
    if (!search) {
      throw new NotFoundError(`Search "${searchId}" was not found`);
    }

    const product = await productRepo.getBySearchId(searchId);
    let analysis = null;
    if (product?.imageHash) {
      analysis = await analysisRepo.getByImageHash(product.imageHash);
    }

    const sourceRuns = await sourceRunRepo.getBySearchId(searchId);
    const results = await resultRepo.getWithVideos(searchId);

    return reply.status(200).send({
      search,
      product: product || null,
      analysis: analysis || null,
      sourceRuns,
      results,
      resultCount: results.length,
    });
  });

  // 3. GET /api/history - Search history
  app.get<{ Querystring: { limit?: string; offset?: string } }>('/api/history', async (request, reply) => {
    const limit = request.query.limit ? parseInt(request.query.limit, 10) : 20;
    const offset = request.query.offset ? parseInt(request.query.offset, 10) : 0;

    const history = await searchRepo.getHistory(limit, offset);
    return reply.status(200).send({
      searches: history,
      limit,
      offset,
    });
  });

  // 4. POST /api/search/:id/retry - Retry failed search
  app.post<{ Params: { id: string } }>('/api/search/:id/retry', async (request, reply) => {
    const searchId = request.params.id;
    const search = await searchRepo.getById(searchId);
    if (!search) {
      throw new NotFoundError(`Search "${searchId}" was not found`);
    }

    await searchRepo.updateStatus(searchId, 'pending');
    try {
      await enqueueSearchPipelineJob({ searchId });
    } catch (err) {
      logger.error({ err, searchId }, 'Failed to enqueue retry search pipeline job');
    }

    return reply.status(202).send({
      searchId,
      status: 'pending',
      message: 'Search job re-enqueued for execution',
    });
  });
}
