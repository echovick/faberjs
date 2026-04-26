import { Queue, FlowProducer } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';
import type { JobContract, QueueConfig } from './types';
import type { Job } from './job';

export class QueueService {
  readonly #queues: Map<string, Queue> = new Map<string, Queue>();
  readonly #connection: ConnectionOptions;
  readonly #defaultQueue: string;

  constructor(config: QueueConfig) {
    this.#connection = config.connection as ConnectionOptions;
    this.#defaultQueue = config.defaultQueue ?? 'default';
  }

  async dispatch(job: JobContract): Promise<void> {
    const faberJob = job as Job;
    const queueName = faberJob.queue ?? this.#defaultQueue;
    const queue = this.#getQueue(queueName);

    await queue.add(faberJob.constructor.name, faberJob.toJSON(), {
      attempts: faberJob.tries,
      backoff: {
        type: 'fixed',
        delay: (faberJob.backoff[0] ?? 60) * 1000,
      },
    });
  }

  async dispatchWithDelay(job: JobContract, delayMs: number): Promise<void> {
    const faberJob = job as Job;
    const queueName = faberJob.queue ?? this.#defaultQueue;
    const queue = this.#getQueue(queueName);

    await queue.add(faberJob.constructor.name, faberJob.toJSON(), {
      delay: delayMs,
      attempts: faberJob.tries,
    });
  }

  async dispatchChain(jobs: JobContract[]): Promise<void> {
    if (jobs.length === 0) return;

    const [first, ...rest] = jobs as Job[];
    if (!first) return;

    const flow = new FlowProducer({ connection: this.#connection });

    const children = rest.map((job) => ({
      name: job.constructor.name,
      data: job.toJSON(),
      queueName: job.queue ?? this.#defaultQueue,
      opts: { attempts: job.tries },
    }));

    await flow.add({
      name: first.constructor.name,
      data: first.toJSON(),
      queueName: first.queue ?? this.#defaultQueue,
      opts: { attempts: first.tries },
      children,
    });
  }

  getQueue(name: string): Queue {
    return this.#getQueue(name);
  }

  async close(): Promise<void> {
    for (const queue of this.#queues.values()) {
      await queue.close();
    }
    this.#queues.clear();
  }

  #getQueue(name: string): Queue {
    if (!this.#queues.has(name)) {
      this.#queues.set(name, new Queue(name, { connection: this.#connection }));
    }
    const queue = this.#queues.get(name);
    if (!queue) throw new Error(`Failed to create queue: ${name}`);
    return queue;
  }
}
