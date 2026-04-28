import { ServiceProvider } from '@faber-js/core';
import { Cache } from './cache';
import { MemoryDriver } from './memory-driver';
import { RedisDriver } from './redis-driver';
import { DatabaseDriver } from './database-driver';
import { RateLimiter } from './rate-limiter';

export interface CacheConfig {
  driver?: 'memory' | 'redis' | 'database';
  prefix?: string;
  redis?: {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
    tls?: boolean;
    url?: string;
  };
  database?: {
    table?: string;
  };
}

export class CacheServiceProvider extends ServiceProvider {
  readonly #config: CacheConfig;

  constructor(app: ConstructorParameters<typeof ServiceProvider>[0], config: CacheConfig = {}) {
    super(app);
    this.#config = config;
  }

  register(): void {
    // Cache is configured lazily in boot() once the db binding is available.
  }

  async boot(): Promise<void> {
    const driver =
      this.#config.driver ?? (process.env['CACHE_DRIVER'] as CacheConfig['driver']) ?? 'memory';

    if (driver === 'redis') {
      const redisDriver = await RedisDriver.connect(this.#config.redis ?? {});
      Cache.configure(redisDriver);
      RateLimiter.configure(redisDriver);
    } else if (driver === 'database') {
      if (!this.app.bound('db')) {
        throw new Error(
          'CacheServiceProvider: database driver requires a db binding in the container.',
        );
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = this.app.make<any>('db');
      const dbDriver = new DatabaseDriver(db, this.#config.database);
      Cache.configure(dbDriver);
      RateLimiter.configure(dbDriver);
    } else {
      const memDriver = new MemoryDriver();
      Cache.configure(memDriver);
      RateLimiter.configure(memDriver);
    }
  }
}
