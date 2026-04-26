import { describe, expect, it, vi } from 'vitest';
import { Job } from './job';

class SendEmailJob extends Job {
  override readonly queue = 'emails';
  override readonly tries = 5;
  override readonly backoff = [30, 60, 120] as const;

  constructor(readonly to: string) {
    super();
  }

  async handle(): Promise<void> {
    // send email
  }
}

class FailingJob extends Job {
  async handle(): Promise<void> {
    throw new Error('intentional failure');
  }

  override async failed(error: Error): Promise<void> {
    process.stderr.write(`Job failed: ${error.message}\n`);
  }
}

describe('Job', () => {
  describe('properties', () => {
    it('exposes queue, tries, and backoff', () => {
      const job = new SendEmailJob('a@test.com');
      expect(job.queue).toBe('emails');
      expect(job.tries).toBe(5);
      expect(job.backoff).toEqual([30, 60, 120]);
    });

    it('has sensible defaults', () => {
      class MinimalJob extends Job {
        async handle(): Promise<void> {
          return;
        }
      }
      const job = new MinimalJob();
      expect(job.queue).toBe('default');
      expect(job.tries).toBe(3);
      expect(job.backoff).toEqual([60, 300, 600]);
    });
  });

  describe('handle()', () => {
    it('executes the job logic', async () => {
      const fn = vi.fn();
      class TrackJob extends Job {
        async handle(): Promise<void> {
          fn();
        }
      }
      await new TrackJob().handle();
      expect(fn).toHaveBeenCalledOnce();
    });
  });

  describe('failed()', () => {
    it('is callable with an error', async () => {
      const job = new FailingJob();
      const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      await job.failed(new Error('boom'));
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('boom'));
      spy.mockRestore();
    });
  });

  describe('toJSON()', () => {
    it('serialises job payload including constructor class name', () => {
      const job = new SendEmailJob('hello@test.com');
      const json = job.toJSON();
      expect(json['__jobClass']).toBe('SendEmailJob');
      expect(json['to']).toBe('hello@test.com');
    });

    it('excludes queue, tries, and backoff from payload', () => {
      const job = new SendEmailJob('x@test.com');
      const json = job.toJSON();
      expect(json['queue']).toBeUndefined();
      expect(json['tries']).toBeUndefined();
      expect(json['backoff']).toBeUndefined();
    });
  });
});
