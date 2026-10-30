import fs from 'fs';
import crypto from 'crypto';
import { SearchRepository } from '../db/repositories/search.repository';
import { ProductRepository } from '../db/repositories/product.repository';
import { ProductAnalysisRepository } from '../db/repositories/product-analysis.repository';
import { ProductResolverService } from './product-resolver.service';
import { QueryGeneratorService } from './query-generator.service';
import { getVisionProvider } from '../providers/vision';
import { pipelineEventBus } from '../sse/bus';
import { logger } from '../utils/logger';

export interface PipelineJobData {
  searchId: string;
}

export class PipelineOrchestratorService {
  private searchRepo = new SearchRepository();
  private productRepo = new ProductRepository();
  private analysisRepo = new ProductAnalysisRepository();
  private resolverService = new ProductResolverService();
  private queryGenerator = new QueryGeneratorService();

  async execute(searchId: string): Promise<void> {
    const startTime = Date.now();
    logger.info({ searchId }, 'Starting pipeline orchestrator execution');

    const search = await this.searchRepo.getById(searchId);
    if (!search) {
      logger.error({ searchId }, 'Search record not found in database');
      return;
    }

    await this.searchRepo.updateStatus(searchId, 'processing');

    try {
      // ----------------------------------------------------------------------
      // Stage 1: Resolving product
      // ----------------------------------------------------------------------
      const stage1Start = Date.now();
      await pipelineEventBus.emitAndPersist({
        searchId,
        stage: 'resolving_product',
        status: 'running',
        payload: { message: 'Resolving product details and web metadata...' },
      });

      let productTitle = search.queryText || 'Custom Product';
      let productDesc = '';
      let productImageUrl: string | undefined;
      let productImageBuffer: Buffer | undefined;
      let productImageHash: string | undefined;
      let brandName: string | undefined;
      let productMetadata: Record<string, unknown> = {};

      if (search.productUrl) {
        const resolved = await this.resolverService.resolve(search.productUrl);
        productTitle = resolved.title;
        productDesc = resolved.description || '';
        productImageUrl = resolved.imageUrl;
        productImageBuffer = resolved.imageBuffer;
        productImageHash = resolved.imageHash;
        brandName = resolved.brand;
        productMetadata = resolved.metadata;
      }

      // Check if an image was directly uploaded by user (uploaded image takes priority!)
      if (search.uploadedImagePath && fs.existsSync(search.uploadedImagePath)) {
        logger.info({ searchId, path: search.uploadedImagePath }, 'User uploaded image takes priority');
        productImageBuffer = fs.readFileSync(search.uploadedImagePath);
        productImageHash = crypto.createHash('sha256').update(productImageBuffer).digest('hex');
        productImageUrl = `/uploads/${search.uploadedImagePath.split(/[/|\\]/).pop()}`;
      }

      // Ensure imageHash is computed upfront for both image and text inputs
      if (!productImageHash) {
        productImageHash = productImageBuffer
          ? crypto.createHash('sha256').update(productImageBuffer).digest('hex')
          : `text_${crypto.createHash('sha256').update(productTitle).digest('hex')}`;
      }

      // Persist resolved product
      const product = await this.productRepo.create({
        searchId,
        title: productTitle,
        description: productDesc,
        imageUrl: productImageUrl,
        imageHash: productImageHash,
        metadata: {
          ...productMetadata,
          brand: brandName,
        },
      });

      await pipelineEventBus.emitAndPersist({
        searchId,
        stage: 'resolving_product',
        status: 'done',
        payload: {
          productId: product.id,
          title: productTitle,
          brand: brandName,
          hasImage: Boolean(productImageUrl || productImageBuffer),
          durationMs: Date.now() - stage1Start,
        },
      });

      // ----------------------------------------------------------------------
      // Stage 2: Extracting product image
      // ----------------------------------------------------------------------
      const stage2Start = Date.now();
      await pipelineEventBus.emitAndPersist({
        searchId,
        stage: 'extracting_image',
        status: 'running',
        payload: { message: 'Extracting and validating product visual assets...' },
      });

      if (!productImageHash && productImageBuffer) {
        productImageHash = crypto.createHash('sha256').update(productImageBuffer).digest('hex');
      }

      await pipelineEventBus.emitAndPersist({
        searchId,
        stage: 'extracting_image',
        status: 'done',
        payload: {
          imageHash: productImageHash || 'no_image',
          imageUrl: productImageUrl,
          durationMs: Date.now() - stage2Start,
        },
      });

      // ----------------------------------------------------------------------
      // Stage 3: Analysing product image ("Image Brain")
      // ----------------------------------------------------------------------
      const stage3Start = Date.now();
      await pipelineEventBus.emitAndPersist({
        searchId,
        stage: 'analysing_image',
        status: 'running',
        payload: { message: 'Image Brain analyzing product attributes with vision model...' },
      });

      const effectiveImageHash = productImageHash || `text_${crypto.createHash('sha256').update(productTitle).digest('hex')}`;
      let analysisResult = await this.analysisRepo.getByImageHash(effectiveImageHash);
      const visionProvider = getVisionProvider();

      if (analysisResult) {
        logger.info({ imageHash: effectiveImageHash }, 'Reusing cached product analysis from image hash');
      } else {
        const visionOutput = await visionProvider.analyze({
          title: productTitle,
          description: productDesc,
          imageUrl: productImageUrl,
          imageBuffer: productImageBuffer,
        });

        const initialQueries = this.queryGenerator.generate(visionOutput, brandName);

        analysisResult = await this.analysisRepo.upsert({
          imageHash: effectiveImageHash,
          attributes: visionOutput,
          queries: initialQueries.expansionTiers,
          hashtags: initialQueries.instagram.hashtags,
          provider: visionProvider.name,
        });
      }

      await pipelineEventBus.emitAndPersist({
        searchId,
        stage: 'analysing_image',
        status: 'done',
        payload: {
          attributes: analysisResult.attributes,
          provider: analysisResult.provider,
          cached: Boolean(analysisResult),
          durationMs: Date.now() - stage3Start,
        },
      });

      // ----------------------------------------------------------------------
      // Stage 4: Generating search queries
      // ----------------------------------------------------------------------
      const stage4Start = Date.now();
      await pipelineEventBus.emitAndPersist({
        searchId,
        stage: 'generating_queries',
        status: 'running',
        payload: { message: 'Generating platform queries, hashtags and expansion tiers...' },
      });

      const generatedQueries = this.queryGenerator.generate(
        analysisResult.attributes as any,
        brandName
      );

      // Update analysis record with latest queries and hashtags
      await this.analysisRepo.upsert({
        imageHash: effectiveImageHash,
        attributes: analysisResult.attributes,
        queries: generatedQueries,
        hashtags: generatedQueries.instagram.hashtags,
        provider: analysisResult.provider,
      });

      await pipelineEventBus.emitAndPersist({
        searchId,
        stage: 'generating_queries',
        status: 'done',
        payload: {
          queries: generatedQueries,
          durationMs: Date.now() - stage4Start,
        },
      });

      // ----------------------------------------------------------------------
      // Stages 5 - 9: Skipped for Phase 2 (Implemented in Phase 3 & 4)
      // ----------------------------------------------------------------------
      const futureStages = [
        { stage: 'fetching_instagram', note: 'Instagram Reels collection implemented in Phase 3' },
        { stage: 'fetching_meta', note: 'Meta Ad Library collection implemented in Phase 3' },
        { stage: 'extracting_frames', note: 'Frame extraction implemented in Phase 4' },
        { stage: 'calculating_similarity', note: 'Visual similarity scoring implemented in Phase 4' },
        { stage: 'removing_duplicates', note: 'Deduplication and clustering implemented in Phase 4' },
      ];

      for (const future of futureStages) {
        await pipelineEventBus.emitAndPersist({
          searchId,
          stage: future.stage,
          status: 'skipped',
          payload: { reason: future.note },
        });
      }

      // ----------------------------------------------------------------------
      // Stage 10: Preparing final results
      // ----------------------------------------------------------------------
      await pipelineEventBus.emitAndPersist({
        searchId,
        stage: 'finalizing_results',
        status: 'done',
        payload: {
          totalDurationMs: Date.now() - startTime,
          message: 'Product resolution and Image Brain analysis completed successfully',
        },
      });

      // Mark search completed
      await this.searchRepo.updateStatus(searchId, 'completed', new Date());
      logger.info({ searchId, totalDurationMs: Date.now() - startTime }, 'Search pipeline completed successfully');
    } catch (err: any) {
      logger.error({ err, searchId }, 'Pipeline orchestrator execution failed');
      await this.searchRepo.updateStatus(searchId, 'failed');

      await pipelineEventBus.emitAndPersist({
        searchId,
        stage: 'finalizing_results',
        status: 'failed',
        payload: {
          error: {
            code: err.code || 'PIPELINE_ERROR',
            message: err.message,
            retryable: err.retryable ?? true,
          },
        },
      });
      throw err;
    }
  }
}
