import { Worker } from 'bullmq';
import type { ConnectionOptions, Job as BullJob } from 'bullmq';

type JobProcessor = (jobName: string, data: Record<string, unknown>) => Promise<void>;

export class QueueWorker {
  readonly #workers: Worker[] = [];
  readonly #connection: ConnectionOptions;

  constructor(connection: ConnectionOptions) {
    this.#connection = connection;
  }

  listen(queueName: string, processor: JobProcessor): this {
    const worker = new Worker(
      queueName,
      async (job: BullJob) => {
        await processor(job.name, job.data as Record<string, unknown>);
      },
      { connection: this.#connection },
    );

    worker.on('failed', (job, err) => {
      const name = job?.name ?? 'unknown';
      process.stderr.write(`[queue] Job "${name}" failed: ${err.message}\n`);
    });

    this.#workers.push(worker);
    return this;
  }

  async close(): Promise<void> {
    await Promise.all(this.#workers.map((w) => w.close()));
    this.#workers.length = 0;
  }
}
