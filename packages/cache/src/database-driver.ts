import type { CacheDriver } from './driver';

// Minimal Knex-like interface so @faber-js/cache doesn't hard-depend on knex types
interface QueryBuilder {
  where(col: string, val: unknown): QueryBuilder;
  first(): Promise<Record<string, unknown> | undefined>;
  insert(data: object): Promise<unknown>;
  update(data: object): Promise<unknown>;
  delete(): Promise<unknown>;
  select(...cols: string[]): QueryBuilder;
}

type KnexLike = (table: string) => QueryBuilder;

export interface DatabaseCacheConfig {
  table?: string;
}

export class DatabaseDriver implements CacheDriver {
  readonly #db: KnexLike;
  readonly #table: string;

  constructor(db: KnexLike, config: DatabaseCacheConfig = {}) {
    this.#db = db;
    this.#table = config.table ?? 'cache';
  }

  private isExpired(expiresAt: number | null): boolean {
    return expiresAt !== null && expiresAt <= Math.floor(Date.now() / 1000);
  }

  async get(key: string): Promise<unknown> {
    const row = await this.#db(this.#table).where('key', key).first();
    if (!row) return null;
    const expiresAt = row['expires_at'] as number | null;
    if (this.isExpired(expiresAt)) {
      await this.forget(key);
      return null;
    }
    try {
      return JSON.parse(row['value'] as string) as unknown;
    } catch {
      return row['value'];
    }
  }

  async put(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
    const serialized = JSON.stringify(value);
    const existing = await this.#db(this.#table).where('key', key).first();
    if (existing) {
      await this.#db(this.#table)
        .where('key', key)
        .update({ value: serialized, expires_at: expiresAt });
    } else {
      await this.#db(this.#table).insert({ key, value: serialized, expires_at: expiresAt });
    }
  }

  async putForever(key: string, value: unknown): Promise<void> {
    const serialized = JSON.stringify(value);
    const existing = await this.#db(this.#table).where('key', key).first();
    if (existing) {
      await this.#db(this.#table).where('key', key).update({ value: serialized, expires_at: null });
    } else {
      await this.#db(this.#table).insert({ key, value: serialized, expires_at: null });
    }
  }

  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== null;
  }

  async forget(key: string): Promise<boolean> {
    const deleted = await this.#db(this.#table).where('key', key).delete();
    return Number(deleted) > 0;
  }

  async flush(): Promise<void> {
    await this.#db(this.#table).delete();
  }

  async increment(key: string, by = 1): Promise<number> {
    const current = Number((await this.get(key)) ?? 0);
    const next = current + by;
    await this.putForever(key, next);
    return next;
  }

  async decrement(key: string, by = 1): Promise<number> {
    return this.increment(key, -by);
  }
}
