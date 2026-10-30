import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { SearchRepository } from '../db/repositories/search.repository';
import { ProductRepository } from '../db/repositories/product.repository';
import { ProductAnalysisRepository } from '../db/repositories/product-analysis.repository';
import { VideoRepository } from '../db/repositories/video.repository';
import { SourceRunRepository } from '../db/repositories/source-run.repository';
import { SearchResultRepository } from '../db/repositories/search-result.repository';
import { SeenVideoRepository } from '../db/repositories/seen-video.repository';
import { ProductResolverService } from './product-resolver.service';
import { QueryGeneratorService } from './query-generator.service';
import { ScoringService, ScoredCandidate } from './scoring.service';
import { DedupService } from './dedup.service';
import { computeDHash } from '../utils/phash';
import { getThumbnailStorageDir } from '../utils/thumbnail-storage';
import { safeFetch } from '../utils/ssrf';
import { getVisionProvider } from '../providers/vision';
import { InstagramCollector, MetaAdLibraryCollector } from '../collectors';
import { pipelineEventBus } from '../sse/bus';
import { logger } from '../utils/logger';
import { CandidateVideo } from '../types';

export interface PipelineJobData {
  searchId: string;
}

export class PipelineOrchestratorService {
  private searchRepo = new SearchRepository();
  private productRepo = new ProductRepository();
  private analysisRepo = new ProductAnalysisRepository();
  private videoRepo = new VideoRepository();
  private sourceRunRepo = new SourceRunRepository();
  private searchResultRepo = new SearchResultRepository();
  private seenVideoRepo = new SeenVideoRepository();
  private resolverService = new ProductResolverService();
  private queryGenerator = new QueryGeneratorService();
  private scoringService: ScoringService;
  private dedupService: DedupService;
  private customIgCollector?: InstagramCollector;
  private customMetaCollector?: MetaAdLibraryCollector;

  constructor(options?: {
    instagramCollector?: InstagramCollector;
    metaCollector?: MetaAdLibraryCollector;
    scoringService?: ScoringService;
    dedupService?: DedupService;
    mode?: 'live' | 'mock';
  }) {
    this.customIgCollector = options?.instagramCollector;
    this.customMetaCollector = options?.metaCollector;
    this.scoringService = options?.scoringService || new ScoringService({ mode: options?.mode });
    this.dedupService = options?.dedupService || new DedupService(this.seenVideoRepo);
  }

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
          hasImage: Boolean(productImageBuffer || productImageUrl),
          durationMs: Date.now() - stage1Start,
        },
      });

      // ----------------------------------------------------------------------
      // Stage 2: Extracting image
      // ----------------------------------------------------------------------
      const stage2Start = Date.now();
      await pipelineEventBus.emitAndPersist({
        searchId,
        stage: 'extracting_image',
        status: 'running',
        payload: { message: 'Extracting product image and calculating visual hashes...' },
      });

      // If we only had an image URL but no buffer, fetch it now
      if (!productImageBuffer && productImageUrl && productImageUrl.startsWith('http')) {
        try {
          const fetchRes = await safeFetch(productImageUrl, { timeoutMs: 8000, maxBytes: 10 * 1024 * 1024 });
          if (fetchRes.buffer.length > 0) {
            productImageBuffer = fetchRes.buffer;
            productImageHash = crypto.createHash('sha256').update(productImageBuffer).digest('hex');
            await this.productRepo.update(product.id, {
              imageHash: productImageHash,
            });
          }
        } catch (err: any) {
          logger.warn({ err: err.message, url: productImageUrl }, 'Could not fetch image buffer for product');
        }
      }

      await pipelineEventBus.emitAndPersist({
        searchId,
        stage: 'extracting_image',
        status: 'done',
        payload: {
          imageHash: productImageHash,
          hasBuffer: Boolean(productImageBuffer),
          durationMs: Date.now() - stage2Start,
        },
      });

      // ----------------------------------------------------------------------
      // Stage 3: Analysing image (Image Brain)
      // ----------------------------------------------------------------------
      const stage3Start = Date.now();
      await pipelineEventBus.emitAndPersist({
        searchId,
        stage: 'analysing_image',
        status: 'running',
        payload: { message: 'Invoking Image Brain to extract structured visual attributes...' },
      });

      const effectiveImageHash = productImageHash || `text_${crypto.createHash('sha256').update(productTitle).digest('hex')}`;
      let analysisResult = await this.analysisRepo.getByImageHash(effectiveImageHash);

      if (analysisResult) {
        logger.info({ imageHash: effectiveImageHash }, 'Reusing cached product analysis from image hash');
      } else {
        const visionProvider = getVisionProvider();
        logger.info({ provider: visionProvider.name }, 'Invoking Vision Provider for product analysis');

        const analysis = await visionProvider.analyze({
          imageUrl: productImageUrl,
          imageBuffer: productImageBuffer,
          title: productTitle,
          description: productDesc,
        });

        // Infer brand if missing
        if (!brandName && analysis.logos && analysis.logos.length > 0) {
          brandName = analysis.logos[0];
          logger.info({ brand: brandName }, 'Inferred brand name from Image Brain logos');
        }

        const savedAnalysis = await this.analysisRepo.upsert({
          imageHash: effectiveImageHash,
          attributes: analysis,
          queries: {},
          hashtags: [],
          provider: visionProvider.name,
        });

        analysisResult = savedAnalysis;
      }

      if (!analysisResult) {
        throw new Error('Failed to resolve or generate product analysis');
      }

      await pipelineEventBus.emitAndPersist({
        searchId,
        stage: 'analysing_image',
        status: 'done',
        payload: {
          attributes: analysisResult.attributes,
          provider: analysisResult.provider,
          durationMs: Date.now() - stage3Start,
        },
      });

      // ----------------------------------------------------------------------
      // Stage 4: Generating queries
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
      // Stages 5 & 6: Parallel Candidate Video Collection (Phase 3 & 4)
      // ----------------------------------------------------------------------
      const selectedSources = search.selectedSources || ['instagram', 'meta'];
      const allCollectedCandidates: CandidateVideo[] = [];
      const sourceRunsMap = new Map<string, string>(); // source -> runRecord.id

      const runCollector = async (
        collector: { source: 'instagram' | 'meta'; collect: (q: any, opt: any) => Promise<any> },
        stageName: 'fetching_instagram' | 'fetching_meta'
      ) => {
        if (!selectedSources.includes(collector.source)) {
          await pipelineEventBus.emitAndPersist({
            searchId,
            stage: stageName,
            status: 'skipped',
            payload: { reason: `Source '${collector.source}' not selected for this search` },
          });
          return null;
        }

        const collectorStart = Date.now();
        const runRecord = await this.sourceRunRepo.create({
          searchId,
          source: collector.source,
          status: 'running',
          requested: 20,
          collected: 0,
          usable: 0,
          shortfall: 20,
        });
        sourceRunsMap.set(collector.source, runRecord.id);

        await pipelineEventBus.emitAndPersist({
          searchId,
          stage: stageName,
          status: 'running',
          payload: {
            message: `Collecting candidate videos from ${collector.source}...`,
            requested: 20,
          },
        });

        try {
          const result = await collector.collect(generatedQueries, {
            targetCount: 20,
            searchId,
          });

          // Persist discovered candidate videos into database
          for (const cand of result.candidates) {
            const savedVideo = await this.videoRepo.upsert({
              platform: cand.platform,
              platformVideoId: cand.platformVideoId,
              canonicalUrl: cand.canonicalUrl,
              thumbnailUrl: cand.thumbnailUrl,
              mediaUrl: cand.mediaUrl,
              caption: cand.caption,
              author: cand.author,
              postedAt: cand.postedAt,
              raw: cand.raw,
              isMock: cand.isMock,
            });

            allCollectedCandidates.push({
              id: savedVideo.id,
              platform: cand.platform,
              platformVideoId: cand.platformVideoId,
              canonicalUrl: cand.canonicalUrl,
              thumbnailUrl: cand.thumbnailUrl,
              mediaUrl: cand.mediaUrl,
              caption: cand.caption,
              author: cand.author,
              postedAt: cand.postedAt,
              mediaPhash: savedVideo.mediaPhash || undefined,
              isMock: cand.isMock,
              raw: cand.raw,
            });
          }

          await this.sourceRunRepo.update(runRecord.id, {
            status: result.error && result.usable === 0 ? 'failed' : 'completed',
            collected: result.collected,
            usable: result.usable,
            shortfall: result.shortfall,
            error: result.error,
            finishedAt: new Date(),
          });

          await pipelineEventBus.emitAndPersist({
            searchId,
            stage: stageName,
            status: result.error && result.usable === 0 ? 'failed' : 'done',
            payload: {
              source: collector.source,
              requested: result.requested,
              collected: result.collected,
              usable: result.usable,
              shortfall: result.shortfall,
              error: result.error,
              cost: result.cost,
              durationMs: Date.now() - collectorStart,
            },
          });

          return result;
        } catch (err: any) {
          logger.error({ err, source: collector.source }, 'Collector failed with unhandled exception');
          await this.sourceRunRepo.update(runRecord.id, {
            status: 'failed',
            collected: 0,
            usable: 0,
            shortfall: 20,
            error: err.message,
            finishedAt: new Date(),
          });

          await pipelineEventBus.emitAndPersist({
            searchId,
            stage: stageName,
            status: 'failed',
            payload: {
              source: collector.source,
              error: err.message,
              durationMs: Date.now() - collectorStart,
            },
          });

          return null;
        }
      };

      const searchMode: 'live' | 'mock' =
        search.mode === 'mock' || process.env.MODE === 'mock' ? 'mock' : 'live';

      const scoringService =
        searchMode === 'mock'
          ? new ScoringService({ mode: 'mock' })
          : this.scoringService;

      const igCollector = this.customIgCollector || new InstagramCollector({ mode: searchMode });
      const metaCollector = this.customMetaCollector || new MetaAdLibraryCollector({ mode: searchMode });

      // Execute Instagram and Meta collectors concurrently in parallel
      await Promise.allSettled([
        runCollector(igCollector, 'fetching_instagram'),
        runCollector(metaCollector, 'fetching_meta'),
      ]);

      // ----------------------------------------------------------------------
      // Stage 7: Extracting frames & perceptual hashes (dHash)
      // ----------------------------------------------------------------------
      const stage7Start = Date.now();
      await pipelineEventBus.emitAndPersist({
        searchId,
        stage: 'extracting_frames',
        status: 'running',
        payload: {
          message: 'Extracting representative frames and computing perceptual hashes (dHash)...',
          candidateCount: allCollectedCandidates.length,
        },
      });

      let extractedHashCount = 0;
      const thumbDir = getThumbnailStorageDir();

      for (const cand of allCollectedCandidates) {
        if (!cand.mediaPhash && cand.thumbnailUrl) {
          try {
            let phash: string | null = null;
            // Check if stored locally in storage/thumbnails
            if (cand.thumbnailUrl.startsWith('/storage/thumbnails/')) {
              const filename = path.basename(cand.thumbnailUrl);
              const localFilePath = path.join(thumbDir, filename);
              if (fs.existsSync(localFilePath)) {
                phash = await computeDHash(localFilePath);
              }
            } else if (cand.thumbnailUrl.startsWith('http')) {
              const res = await safeFetch(cand.thumbnailUrl, { timeoutMs: 6000 });
              if (res.statusCode >= 200 && res.statusCode < 300 && res.buffer.length > 0) {
                phash = await computeDHash(res.buffer);
              }
            }

            if (phash) {
              cand.mediaPhash = phash;
              extractedHashCount++;
              await this.videoRepo.upsert({
                id: cand.id,
                platform: cand.platform,
                platformVideoId: cand.platformVideoId,
                canonicalUrl: cand.canonicalUrl,
                thumbnailUrl: cand.thumbnailUrl,
                mediaUrl: cand.mediaUrl,
                caption: cand.caption,
                author: cand.author,
                postedAt: cand.postedAt,
                mediaPhash: phash,
                raw: cand.raw,
                isMock: cand.isMock,
              });
            }
          } catch (err: any) {
            logger.debug({ err: err.message, id: cand.id }, 'Could not compute dHash for candidate');
          }
        }
      }

      await pipelineEventBus.emitAndPersist({
        searchId,
        stage: 'extracting_frames',
        status: 'done',
        payload: {
          totalCandidates: allCollectedCandidates.length,
          extractedHashCount,
          durationMs: Date.now() - stage7Start,
        },
      });

      // ----------------------------------------------------------------------
      // Stage 8: Calculating Similarity (Hybrid CLIP + VLM Scoring)
      // ----------------------------------------------------------------------
      const stage8Start = Date.now();
      await pipelineEventBus.emitAndPersist({
        searchId,
        stage: 'calculating_similarity',
        status: 'running',
        payload: {
          message: 'Evaluating hybrid semantic embeddings and vision rubric...',
          candidateCount: allCollectedCandidates.length,
          minMatchThreshold: search.minMatchThreshold,
        },
      });

      let scoredCandidates = await scoringService.scoreCandidates(
        {
          title: productTitle,
          brand: brandName,
          analysis: analysisResult.attributes as any,
        },
        allCollectedCandidates
      );

      // Persist any generated embedding vectors on videos
      for (const scored of scoredCandidates) {
        if (scored.candidate.embedding) {
          await this.videoRepo.upsert({
            id: scored.candidate.id,
            platform: scored.candidate.platform,
            platformVideoId: scored.candidate.platformVideoId,
            canonicalUrl: scored.candidate.canonicalUrl,
            thumbnailUrl: scored.candidate.thumbnailUrl,
            mediaUrl: scored.candidate.mediaUrl,
            caption: scored.candidate.caption,
            author: scored.candidate.author,
            postedAt: scored.candidate.postedAt,
            mediaPhash: scored.candidate.mediaPhash,
            embedding: scored.candidate.embedding,
            raw: scored.candidate.raw,
            isMock: scored.candidate.isMock,
          });
        }
      }

      await pipelineEventBus.emitAndPersist({
        searchId,
        stage: 'calculating_similarity',
        status: 'done',
        payload: {
          totalScored: scoredCandidates.length,
          aboveThresholdCount: scoredCandidates.filter((s) => !s.belowThreshold).length,
          durationMs: Date.now() - stage8Start,
        },
      });

      // ----------------------------------------------------------------------
      // Stage 9: Removing Duplicates (Clustering + Cross-search filtering)
      // ----------------------------------------------------------------------
      const stage9Start = Date.now();
      await pipelineEventBus.emitAndPersist({
        searchId,
        stage: 'removing_duplicates',
        status: 'running',
        payload: {
          message: 'Running near-duplicate clustering and cross-search seen video filtering...',
        },
      });

      let dedupResult = await this.dedupService.deduplicateAndFilter(scoredCandidates, {
        searchId,
        dHashThreshold: 10,
        textJaccardThreshold: 0.85,
        excludePreviouslySeen: true,
      });

      await pipelineEventBus.emitAndPersist({
        searchId,
        stage: 'removing_duplicates',
        status: 'done',
        payload: {
          totalInput: scoredCandidates.length,
          duplicatesRemoved: dedupResult.duplicatesRemoved,
          previouslySeenFiltered: dedupResult.previouslySeenFiltered,
          uniqueRemaining: dedupResult.uniqueCandidates.length,
          durationMs: Date.now() - stage9Start,
        },
      });

      // ----------------------------------------------------------------------
      // Dedup-Aware Shortfall Loop: Query Expansion if Usable < 20
      // ----------------------------------------------------------------------
      const maxExpansionRuns = Number(process.env.APIFY_MAX_RUNS_PER_SEARCH || 3);
      let currentRunCount = 1;

      for (const source of selectedSources) {
        let usableForSource = dedupResult.uniqueCandidates.filter(
          (item) => !item.belowThreshold && item.candidate.platform === source
        ).length;

        if (usableForSource < 20 && currentRunCount < maxExpansionRuns) {
          logger.info(
            { source, currentUsable: usableForSource, target: 20 },
            'Usable count below target after dedup. Triggering expansion query tier...'
          );

          // Get expansion queries
          const expansionTier =
            currentRunCount === 1
              ? generatedQueries.expansionTiers?.tier1
              : generatedQueries.expansionTiers?.tier2;

          if (expansionTier && expansionTier.length > 0) {
            currentRunCount++;
            const collector = source === 'instagram' ? igCollector : metaCollector;
            const expandedQueries = {
              ...generatedQueries,
              instagram: {
                ...generatedQueries.instagram,
                hashtags: expansionTier.map((t) => t.replace(/[^a-zA-Z0-9]/g, '')).filter(Boolean),
              },
              meta: {
                ...generatedQueries.meta,
                searchTerms: expansionTier.slice(0, 4),
              },
            };

            try {
              const expansionResult = await collector.collect(expandedQueries, {
                targetCount: 20 - usableForSource,
                searchId,
              });

              if (expansionResult.candidates.length > 0) {
                const newCandidates: CandidateVideo[] = [];
                for (const cand of expansionResult.candidates) {
                  const savedVideo = await this.videoRepo.upsert({
                    platform: cand.platform,
                    platformVideoId: cand.platformVideoId,
                    canonicalUrl: cand.canonicalUrl,
                    thumbnailUrl: cand.thumbnailUrl,
                    mediaUrl: cand.mediaUrl,
                    caption: cand.caption,
                    author: cand.author,
                    postedAt: cand.postedAt,
                    raw: cand.raw,
                    isMock: cand.isMock,
                  });
                  newCandidates.push({
                    id: savedVideo.id,
                    platform: cand.platform,
                    platformVideoId: cand.platformVideoId,
                    canonicalUrl: cand.canonicalUrl,
                    thumbnailUrl: cand.thumbnailUrl,
                    mediaUrl: cand.mediaUrl,
                    caption: cand.caption,
                    author: cand.author,
                    postedAt: cand.postedAt,
                    mediaPhash: savedVideo.mediaPhash || undefined,
                    isMock: cand.isMock,
                    raw: cand.raw,
                  });
                }

                // Extract frames for new candidates
                for (const cand of newCandidates) {
                  if (!cand.mediaPhash && cand.thumbnailUrl) {
                    try {
                      let phash: string | null = null;
                      if (cand.thumbnailUrl.startsWith('/storage/thumbnails/')) {
                        const filename = path.basename(cand.thumbnailUrl);
                        const localFilePath = path.join(thumbDir, filename);
                        if (fs.existsSync(localFilePath)) {
                          phash = await computeDHash(localFilePath);
                        }
                      } else if (cand.thumbnailUrl.startsWith('http')) {
                        const res = await safeFetch(cand.thumbnailUrl, { timeoutMs: 6000 });
                        if (res.statusCode >= 200 && res.statusCode < 300 && res.buffer.length > 0) {
                          phash = await computeDHash(res.buffer);
                        }
                      }
                      if (phash) {
                        cand.mediaPhash = phash;
                      }
                    } catch {}
                  }
                }

                // Score new candidates
                const scoredNew = await scoringService.scoreCandidates(
                  {
                    title: productTitle,
                    brand: brandName,
                    analysis: analysisResult.attributes as any,
                  },
                  newCandidates
                );

                // Re-run dedup over merged list
                scoredCandidates = [...scoredCandidates, ...scoredNew];
                dedupResult = await this.dedupService.deduplicateAndFilter(scoredCandidates, {
                  searchId,
                  dHashThreshold: 10,
                  textJaccardThreshold: 0.85,
                  excludePreviouslySeen: true,
                });
              }
            } catch (err: any) {
              logger.warn({ err: err.message, source }, 'Expansion query collection failed');
            }
          }
        }
      }

      // ----------------------------------------------------------------------
      // Stage 10: Finalizing Results & Ranking
      // ----------------------------------------------------------------------
      const stage10Start = Date.now();
      await pipelineEventBus.emitAndPersist({
        searchId,
        stage: 'finalizing_results',
        status: 'running',
        payload: { message: 'Ranking results and updating final shortfall accounting...' },
      });

      // Filter and rank above-threshold unique items
      const aboveThresholdItems = dedupResult.uniqueCandidates
        .filter((item) => !item.belowThreshold && !item.duplicateOf && !item.previouslySeen)
        .sort((a, b) => b.matchScore - a.matchScore);

      // Assign ranks (1..N) to above-threshold results
      const rankedMap = new Map<string, number>();
      aboveThresholdItems.forEach((item, index) => {
        rankedMap.set(item.candidate.id, index + 1);
      });

      // Persist all processed candidates into search_results table
      const searchResultsToInsert = dedupResult.allProcessed.map((item) => ({
        searchId,
        videoId: item.candidate.id,
        matchScore: item.matchScore,
        scoreBreakdown: item.scoreBreakdown as unknown as Record<string, unknown>,
        explanation: item.explanation,
        belowThreshold: item.belowThreshold,
        previouslySeen: Boolean(item.previouslySeen),
        duplicateOf: item.duplicateOf,
        rank: rankedMap.get(item.candidate.id) || null,
      }));

      await this.searchResultRepo.createMany(searchResultsToInsert);

      // Register the returned above-threshold videos in seen_videos for future cross-search filtering
      await this.dedupService.registerSeenVideos(
        aboveThresholdItems.map((item) => item.candidate.id),
        searchId
      );

      // Update source_runs records finishedAt
      for (const source of selectedSources) {
        const runId = sourceRunsMap.get(source);
        if (runId) {
          await this.sourceRunRepo.update(runId, {
            finishedAt: new Date(),
          });
        }
      }

      await pipelineEventBus.emitAndPersist({
        searchId,
        stage: 'finalizing_results',
        status: 'done',
        payload: {
          totalDurationMs: Date.now() - startTime,
          aboveThresholdCount: aboveThresholdItems.length,
          totalProcessed: dedupResult.allProcessed.length,
          duplicatesRemoved: dedupResult.duplicatesRemoved,
          previouslySeenFiltered: dedupResult.previouslySeenFiltered,
          message: 'Product discovery pipeline completed successfully',
        },
      });

      // Mark search completed
      await this.searchRepo.updateStatus(searchId, 'completed', new Date());
      logger.info(
        {
          searchId,
          aboveThresholdCount: aboveThresholdItems.length,
          totalDurationMs: Date.now() - startTime,
        },
        'Search pipeline completed successfully'
      );
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
