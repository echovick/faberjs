import type { CacheDriver } from './driver';

export interface RedisConfig {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  prefix?: string;
  tls?: boolean;
  url?: string;
}

// Minimal interface so we don't need ioredis types at runtime unless it's installed
interface IORedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  set(key: string, value: string, exArg: 'EX', seconds: number): Promise<unknown>;
  set(key: string, value: string, nx: 'NX', ex: 'EX', seconds: number): Promise<string | null>;
  del(...keys: string[]): Promise<number>;
  exists(...keys: string[]): Promise<number>;
  flushdb(): Promise<unknown>;
  incrby(key: string, increment: number): Promise<number>;
  decrby(key: string, decrement: number): Promise<number>;
  eval(script: string, numkeys: number, ...args: string[]): Promise<unknown>;
  quit(): Promise<unknown>;
}

export class RedisDriver implements CacheDriver {
  readonly #redis: IORedisLike;
  readonly #prefix: string;

  constructor(redis: IORedisLike, prefix = 'faber:') {
    this.#redis = redis;
    this.#prefix = prefix;
  }

  static async connect(config: RedisConfig = {}): Promise<RedisDriver> {
    // Dynamic import so ioredis is not bundled unless used
    let Redis: new (opts: object) => IORedisLike;
    try {
      const mod = await import('ioredis');
      Redis = (mod as unknown as { default: new (opts: object) => IORedisLike }).default;
    } catch {
      throw new Error('ioredis is not installed. Run: pnpm add ioredis');
    }

    const opts: Record<string, unknown> = {
      host: config.host ?? process.env['REDIS_HOST'] ?? '127.0.0.1',
      port: config.port ?? Number(process.env['REDIS_PORT'] ?? 6379),
      password: config.password ?? process.env['REDIS_PASSWORD'] ?? undefined,
      db: config.db ?? Number(process.env['REDIS_DB'] ?? 0),
      lazyConnect: true,
      enableReadyCheck: false,
    };

    if (config.url ?? process.env['REDIS_URL']) {
      return new RedisDriver(
        new Redis({ ...(config.url ? { host: config.url } : { host: process.env['REDIS_URL'] }) }),
        config.prefix,
      );
    }

    if (config.tls) opts['tls'] = {};

    const client = new Redis(opts);
    return new RedisDriver(client, config.prefix);
  }

  private k(key: string): string {
    return `${this.#prefix}${key}`;
  }

  async get(key: string): Promise<unknown> {
    const raw = await this.#redis.get(this.k(key));
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return raw;
    }
  }

  async put(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await (this.#redis.set as (k: string, v: string, ex: 'EX', s: number) => Promise<unknown>)(
      this.k(key),
      JSON.stringify(value),
      'EX',
      ttlSeconds,
    );
  }

  async putForever(key: string, value: unknown): Promise<void> {
    await (this.#redis.set as (k: string, v: string) => Promise<unknown>)(
      this.k(key),
      JSON.stringify(value),
    );
  }

  async has(key: string): Promise<boolean> {
    return (await this.#redis.exists(this.k(key))) > 0;
  }

  async forget(key: string): Promise<boolean> {
    return (await this.#redis.del(this.k(key))) > 0;
  }

  async flush(): Promise<void> {
    await this.#redis.flushdb();
  }

  async increment(key: string, by = 1): Promise<number> {
    return this.#redis.incrby(this.k(key), by);
  }

  async decrement(key: string, by = 1): Promise<number> {
    return this.#redis.decrby(this.k(key), by);
  }

  /** @internal Exposed for atomic lock and tagged cache. */
  getRedis(): IORedisLike {
    return this.#redis;
  }

  getPrefix(): string {
    return this.#prefix;
  }
}
