import { EventEmitter } from 'events';
import { PipelineEventRepository, PipelineEventSelect } from '../db/repositories/pipeline-event.repository';
import { logger } from '../utils/logger';

export interface EmitPipelineEventOptions {
  searchId: string;
  stage: string;
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
  payload?: Record<string, unknown>;
}

class PipelineEventBus extends EventEmitter {
  private repository = new PipelineEventRepository();

  constructor() {
    super();
    this.setMaxListeners(100);
  }

  async emitAndPersist(eventData: EmitPipelineEventOptions): Promise<PipelineEventSelect> {
    try {
      const persisted = await this.repository.create({
        searchId: eventData.searchId,
        stage: eventData.stage,
        status: eventData.status,
        payload: eventData.payload || {},
      });

      // Emit event on channel keyed by searchId
      this.emit(`search:${eventData.searchId}`, persisted);
      return persisted;
    } catch (err) {
      logger.error({ err, eventData }, 'Failed to persist and emit pipeline event');
      throw err;
    }
  }

  subscribe(searchId: string, listener: (event: PipelineEventSelect) => void): () => void {
    const channel = `search:${searchId}`;
    this.on(channel, listener);
    return () => {
      this.off(channel, listener);
    };
  }
}

export const pipelineEventBus = new PipelineEventBus();
