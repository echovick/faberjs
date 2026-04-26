import { Application } from '@faberjs/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatch } from './dispatch';
import type { JobContract, QueueContract } from './types';

class SendEmailJob implements JobContract {
  async handle(): Promise<void> {
    return;
  }
}

describe('dispatch()', () => {
  afterEach(() => {
    Application.clearInstance();
  });

  describe('when queue service is not bound', () => {
    beforeEach(() => {
      new Application();
    });

    it('throws a descriptive error', async () => {
      await expect(dispatch(new SendEmailJob())).rejects.toThrow('No queue service registered');
    });
  });

  describe('when queue service is bound', () => {
    let mockQueue: QueueContract;

    beforeEach(() => {
      const app = new Application();
      mockQueue = {
        dispatch: vi.fn().mockResolvedValue(undefined),
        dispatchChain: vi.fn().mockResolvedValue(undefined),
        dispatchWithDelay: vi.fn().mockResolvedValue(undefined),
      };
      app.instance('queue', mockQueue);
    });

    it('calls queue.dispatch() with the job instance', async () => {
      const job = new SendEmailJob();
      await dispatch(job);
      expect(mockQueue.dispatch).toHaveBeenCalledWith(job);
    });

    it('returns the promise from queue.dispatch()', async () => {
      await expect(dispatch(new SendEmailJob())).resolves.toBeUndefined();
    });
  });
});
