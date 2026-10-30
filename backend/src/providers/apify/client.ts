import { logger } from '../../utils/logger';
import { AppError } from '../../utils/errors';

export interface ApifyCallOptions {
  timeoutSeconds?: number;
  maxItems?: number;
  memory?: number;
}

export class ApifyClient {
  private token: string;
  private consecutiveFailures = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold = 3;
  private readonly cooldownMs = 30000;

  constructor(token?: string) {
    this.token = token !== undefined ? token : (process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN || '');
  }

  hasToken(): boolean {
    return Boolean(this.token && this.token.trim() !== '');
  }

  resetCircuitBreaker(): void {
    this.consecutiveFailures = 0;
    this.lastFailureTime = 0;
  }

  /**
   * Synchronously triggers an Apify actor and returns the dataset items.
   * Includes circuit breaker, exponential backoff for 429/503, and quota handling.
   */
  async callActorSync<T = any>(
    actorId: string,
    input: Record<string, unknown>,
    options: ApifyCallOptions = {}
  ): Promise<T[]> {
    if (!this.hasToken()) {
      throw new AppError(
        'APIFY_TOKEN_MISSING',
        'APIFY_TOKEN is not configured in environment',
        401,
        {},
        false
      );
    }

    // 1. Circuit breaker check
    if (this.consecutiveFailures >= this.failureThreshold) {
      const timeSinceFailure = Date.now() - this.lastFailureTime;
      if (timeSinceFailure < this.cooldownMs) {
        logger.warn(
          { actorId, cooldownRemaining: this.cooldownMs - timeSinceFailure },
          'Apify client circuit breaker is OPEN. Fast-failing request.'
        );
        throw new AppError(
          'CIRCUIT_BREAKER_OPEN',
          `Apify circuit breaker is open after ${this.consecutiveFailures} consecutive failures. Retrying in ${Math.round((this.cooldownMs - timeSinceFailure) / 1000)}s.`,
          503,
          { actorId },
          true
        );
      }
      // Cooldown expired, half-open state: allow this attempt
      this.consecutiveFailures = 0;
    }

    const normId = actorId.replace('/', '~');
    const timeout = options.timeoutSeconds ?? 60;
    const maxItems = options.maxItems ?? parseInt(process.env.APIFY_MAX_ITEMS_PER_RUN || '40', 10);

    let url = `https://api.apify.com/v2/acts/${normId}/run-sync-get-dataset-items?token=${this.token}&timeout=${timeout}`;
    if (maxItems) {
      url += `&maxItems=${maxItems}`;
    }
    if (options.memory) {
      url += `&memory=${options.memory}`;
    }

    const maxRetries = 2;
    let attempt = 0;

    while (attempt <= maxRetries) {
      attempt++;
      try {
        logger.info(
          { actorId, attempt, timeout, maxItems },
          'Executing Apify Actor run'
        );

        const controller = new AbortController();
        const timeoutTimer = setTimeout(() => controller.abort(), (timeout + 5) * 1000);

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'ViDashboard-Collector/1.0',
          },
          body: JSON.stringify(input),
          signal: controller.signal,
        });

        clearTimeout(timeoutTimer);

        // 2. Handle Rate Limiting (429) & Temporary 503s with backoff
        if ((response.status === 429 || response.status === 503) && attempt <= maxRetries) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt), 5000);
          logger.warn(
            { actorId, status: response.status, attempt, backoffMs },
            'Apify rate limited or temporarily unavailable. Backing off...'
          );
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }

        // 3. Handle Quota Exceeded (402 or quota error messages)
        if (response.status === 402) {
          const errText = await response.text();
          this.recordFailure();
          throw new AppError(
            'APIFY_QUOTA_EXCEEDED',
            `Apify monthly usage quota or spending limit exceeded: ${errText}`,
            402,
            { actorId, error: errText },
            false
          );
        }

        // 4. Handle other error statuses
        if (!response.ok) {
          const errorBody = await response.text();
          let parsedMsg = errorBody;
          try {
            const parsed = JSON.parse(errorBody);
            parsedMsg = parsed.error?.message || errorBody;
          } catch {}

          if (parsedMsg.toLowerCase().includes('quota') || parsedMsg.toLowerCase().includes('usage limit')) {
            this.recordFailure();
            throw new AppError(
              'APIFY_QUOTA_EXCEEDED',
              `Apify quota exceeded: ${parsedMsg}`,
              402,
              { actorId },
              false
            );
          }

          this.recordFailure();
          throw new AppError(
            'APIFY_RUN_FAILED',
            `Apify actor ${actorId} returned HTTP ${response.status}: ${parsedMsg}`,
            response.status >= 500 ? 502 : 400,
            { actorId, status: response.status },
            response.status >= 500
          );
        }

        // 5. Parse dataset items
        const rawText = await response.text();
        if (!rawText || rawText.trim() === '') {
          this.recordSuccess();
          return [];
        }

        let items: any[];
        try {
          items = JSON.parse(rawText);
        } catch (jsonErr: any) {
          this.recordFailure();
          throw new AppError(
            'APIFY_MALFORMED_OUTPUT',
            `Apify actor returned invalid JSON output: ${jsonErr.message}`,
            502,
            { actorId },
            false
          );
        }

        if (!Array.isArray(items)) {
          // Check if response contains an error object
          if (items && (items as any).error) {
            const errStr = String((items as any).error);
            this.recordFailure();
            throw new AppError(
              'APIFY_RUN_FAILED',
              `Apify actor reported execution error: ${errStr}`,
              400,
              { actorId },
              false
            );
          }
          items = [items];
        }

        // Filter out empty error stubs if returned as items
        const validItems = items.filter((item) => {
          if (!item) return false;
          if (item.error && !item.id && !item.ad_archive_id && !item.url) {
            logger.warn({ actorId, error: item.error }, 'Apify dataset item contained an error note');
            return false;
          }
          return true;
        });

        logger.info(
          { actorId, totalReturned: items.length, validItems: validItems.length },
          'Apify run completed successfully'
        );

        this.recordSuccess();
        return validItems as T[];
      } catch (err: any) {
        if (err.name === 'AbortError') {
          this.recordFailure();
          throw new AppError(
            'APIFY_TIMEOUT',
            `Apify actor run timed out after ${timeout}s`,
            504,
            { actorId, timeout },
            true
          );
        }

        if (err instanceof AppError) {
          throw err;
        }

        if (attempt > maxRetries) {
          this.recordFailure();
          throw new AppError(
            'APIFY_NETWORK_ERROR',
            `Apify request failed: ${err.message}`,
            502,
            { actorId },
            true
          );
        }

        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    return [];
  }

  private recordSuccess(): void {
    this.consecutiveFailures = 0;
  }

  private recordFailure(): void {
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();
  }
}
