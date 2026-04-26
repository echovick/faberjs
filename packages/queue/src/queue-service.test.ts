import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock BullMQ before importing QueueService so the module is replaced
const mockQueueAdd = vi.fn().mockResolvedValue({ id: '1' });
const mockQueueClose = vi.fn().mockResolvedValue(undefined);
const mockFlowAdd = vi.fn().mockResolvedValue({ job: { id: '1' } });

vi.mock('bullmq', () => {
  return {
    Queue: vi.fn().mockImplementation(() => ({
      add: mockQueueAdd,
      close: mockQueueClose,
    })),
    FlowProducer: vi.fn().mockImplementation(() => ({
      add: mockFlowAdd,
    })),
    Worker: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

import { QueueService } from './queue-service';
import { Job } from './job';
import type { QueueConfig } from './types';

const config: QueueConfig = {
  connection: { host: '127.0.0.1', port: 6379 },
  defaultQueue: 'test',
};

class TestJob extends Job {
  override readonly queue = 'test';
  async handle(): Promise<void> {
    return;
  }
}

class SlowJob extends Job {
  override readonly queue = 'test';
  override readonly tries = 2;
  override readonly backoff = [1, 2] as const;
  async handle(): Promise<void> {
    return;
  }
}

describe('QueueService', () => {
  let service: QueueService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new QueueService(config);
  });

  afterEach(async () => {
    await service.close();
  });

  describe('dispatch()', () => {
    it('adds a job to the queue', async () => {
      const job = new TestJob();
      await service.dispatch(job);
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'TestJob',
        expect.objectContaining({ __jobClass: 'TestJob' }),
        expect.objectContaining({ attempts: 3 }),
      );
    });

    it('uses the job queue name', async () => {
      class EmailJob extends Job {
        override readonly queue = 'emails';
        async handle(): Promise<void> {
          return;
        }
      }
      const job = new EmailJob();
      await service.dispatch(job);
      expect(mockQueueAdd).toHaveBeenCalledWith('EmailJob', expect.any(Object), expect.any(Object));
    });
  });

  describe('dispatchWithDelay()', () => {
    it('adds a delayed job to the queue with delay option', async () => {
      const job = new TestJob();
      await service.dispatchWithDelay(job, 5000);
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'TestJob',
        expect.any(Object),
        expect.objectContaining({ delay: 5000 }),
      );
    });
  });

  describe('retry/backoff config', () => {
    it('passes attempts through from job.tries', async () => {
      const job = new SlowJob();
      await service.dispatch(job);
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'SlowJob',
        expect.any(Object),
        expect.objectContaining({ attempts: 2 }),
      );
    });

    it('passes backoff delay from first backoff value', async () => {
      const job = new SlowJob();
      await service.dispatch(job);
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'SlowJob',
        expect.any(Object),
        expect.objectContaining({
          backoff: expect.objectContaining({ delay: 1000 }), // 1 second * 1000ms
        }),
      );
    });
  });

  describe('dispatchChain()', () => {
    it('dispatches multiple jobs as a chain via FlowProducer', async () => {
      const jobs = [new TestJob(), new TestJob()];
      await service.dispatchChain(jobs);
      expect(mockFlowAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'TestJob',
          children: expect.arrayContaining([expect.objectContaining({ name: 'TestJob' })]),
        }),
      );
    });

    it('handles empty chain gracefully without calling FlowProducer', async () => {
      await service.dispatchChain([]);
      expect(mockFlowAdd).not.toHaveBeenCalled();
    });

    it('dispatches a single-job chain without children', async () => {
      await service.dispatchChain([new TestJob()]);
      expect(mockFlowAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'TestJob',
        }),
      );
    });
  });

  describe('close()', () => {
    it('closes all open queues', async () => {
      await service.dispatch(new TestJob());
      await service.close();
      expect(mockQueueClose).toHaveBeenCalled();
    });
  });
});
