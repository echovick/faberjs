import { ServiceProvider } from '@faberjs/core';
import { QueueService } from './queue-service';
import type { QueueConfig } from './types';

export class QueueServiceProvider extends ServiceProvider {
  register(): void {
    this.app.singleton('queue', () => {
      const config = this.app.bound('config.queue')
        ? this.app.make<QueueConfig>('config.queue')
        : {
            connection: { host: '127.0.0.1', port: 6379 },
            defaultQueue: 'default',
          };
      return new QueueService(config);
    });
  }
}
