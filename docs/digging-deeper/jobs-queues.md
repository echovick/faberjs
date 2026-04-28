# Jobs & Queues

FaberJS uses BullMQ (backed by Redis) for job queues. A job is a class that represents a discrete unit of async work. Dispatch a job and it runs in the background without blocking the HTTP response.

Like Laravel's `dispatch(new SendEmailJob($user))`, FaberJS uses a `dispatch()` global function.

## Sync driver (no Redis)

For local development and testing you can run jobs inline — no Redis required:

```bash
# .env
QUEUE_DRIVER=sync
```

When `QUEUE_DRIVER=sync`, every `dispatch()` call executes the job immediately in the same process. Remove this for staging and production where you want real background processing.

## Prerequisites (BullMQ / Redis)

For background processing you need Redis running and `QueueServiceProvider` registered:

```typescript
// bootstrap/app.ts
import { QueueServiceProvider } from '@faber-js/queue';
import queueConfig from '../config/queue';

app.register(new QueueServiceProvider(app, queueConfig));
```

```typescript
// config/queue.ts
import { env } from '@faber-js/config';

export default {
  connection: {
    host: env('QUEUE_REDIS_HOST', '127.0.0.1'),
    port: env('QUEUE_REDIS_PORT', 6379),
  },
  defaultQueue: 'default',
};
```

## Creating a job

```bash
npx faber make:job SendWelcomeEmail
```

Generated file (`app/jobs/SendWelcomeEmailJob.ts`):

```typescript
export class SendWelcomeEmailJob {
  readonly queue = 'default';
  readonly tries = 3;

  async handle(): Promise<void> {
    // Add your job logic here
  }
}
```

A real implementation:

```typescript
import { Job } from '@faber-js/queue';

export class SendWelcomeEmailJob extends Job {
  override readonly queue = 'emails';
  override readonly tries = 5;
  override readonly backoff = [60, 300, 900]; // seconds: 1m, 5m, 15m

  constructor(
    private readonly userId: number,
    private readonly email: string,
    private readonly name: string,
  ) {
    super();
  }

  async handle(): Promise<void> {
    // Send the email using your email library
    await mailer.send({
      to: this.email,
      subject: `Welcome, ${this.name}!`,
      template: 'welcome',
      data: { name: this.name },
    });
  }

  override async failed(error: Error): Promise<void> {
    console.error(`Failed to send welcome email to ${this.email}:`, error.message);
  }
}
```

## Dispatching a job

Import `dispatch` from `@faber-js/queue` and call it anywhere — in a service, controller, or even another job:

```typescript
import { dispatch } from '@faber-js/queue';
import { SendWelcomeEmailJob } from '../jobs/SendWelcomeEmailJob';

await dispatch(new SendWelcomeEmailJob(user.id, user.email, user.name));
```

## The `Job` base class

Extend `Job` from `@faber-js/queue` for full functionality. It provides:

| Property  | Default          | Description                                                |
| --------- | ---------------- | ---------------------------------------------------------- |
| `queue`   | `'default'`      | Which queue to push the job onto                           |
| `tries`   | `3`              | How many times to attempt the job before marking it failed |
| `backoff` | `[60, 300, 600]` | Seconds to wait between retry attempts                     |

Override any of these in your subclass:

```typescript
export class ProcessVideoJob extends Job {
  override readonly queue = 'heavy';
  override readonly tries = 1; // only try once
  override readonly backoff = []; // no retries

  constructor(private readonly videoId: number) {
    super();
  }

  async handle(): Promise<void> {
    // expensive processing
  }
}
```

## Delayed dispatch

Dispatch a job to run after a delay:

```typescript
import { Application } from '@faber-js/core';
import type { QueueContract } from '@faber-js/queue';

const queue = Application.getInstance().make<QueueContract>('queue');
await queue.dispatchWithDelay(new SendReminderJob(userId), 24 * 60 * 60 * 1000); // 24 hours
```

## Job chaining

Run jobs sequentially — each starts only after the previous one completes:

```typescript
const queue = Application.getInstance().make<QueueContract>('queue');

await queue.dispatchChain([
  new ProcessPaymentJob(orderId),
  new SendReceiptJob(orderId),
  new UpdateInventoryJob(orderId),
]);
```

## Named queues

Route jobs to specific queues for priority or resource isolation:

```typescript
export class HighPriorityJob extends Job {
  override readonly queue = 'high';
}

export class LowPriorityJob extends Job {
  override readonly queue = 'low';
}
```

## Error handling

Override `failed(error)` to handle permanent failures (after all retries are exhausted):

```typescript
async handle(): Promise<void> {
  // job logic
}

override async failed(error: Error): Promise<void> {
  await event({ type: 'JobFailed', jobClass: this.constructor.name, error: error.message });
}
```

## Job serialisation

Jobs are serialised to JSON before being pushed to Redis. All constructor arguments must be JSON-serialisable (primitives, plain objects, arrays). Do not pass model instances — pass IDs instead and look them up in `handle()`:

```typescript
// Bad: passing a model instance
await dispatch(new ProcessUserJob(user));

// Good: passing a serialisable ID
await dispatch(new ProcessUserJob(user.getAttribute('id') as number));
```

## Running workers

Start a queue worker to process jobs. This is separate from `npx faber serve`:

```bash
# There is no built-in faber queue:work command yet — run your worker script directly:
node dist/worker.js
```

A typical worker script:

```typescript
// worker.ts
import './bootstrap/app'; // boot the application
import { Worker } from 'bullmq';
import { env } from '@faber-js/config';

const connection = {
  host: env('QUEUE_REDIS_HOST', '127.0.0.1'),
  port: env('QUEUE_REDIS_PORT', 6379),
};

const worker = new Worker(
  'default',
  async (job) => {
    // Deserialise and call handle()
    const { __jobClass, ...payload } = job.data;
    // resolve your job class and call handle()
  },
  { connection },
);

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.name} failed:`, err.message);
});
```
