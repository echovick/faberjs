import type { CacheDriver } from './driver';

interface Entry {
  value: unknown;
  expiresAt: number | null; // null = forever
}

export class MemoryDriver implements CacheDriver {
  readonly #store = new Map<string, Entry>();

  private isExpired(entry: Entry): boolean {
    return entry.expiresAt !== null && entry.expiresAt <= Date.now();
  }

  async get(key: string): Promise<unknown> {
    const entry = this.#store.get(key);
    if (!entry || this.isExpired(entry)) {
      this.#store.delete(key);
      return null;
    }
    return entry.value;
  }

  async put(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    this.#store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async putForever(key: string, value: unknown): Promise<void> {
    this.#store.set(key, { value, expiresAt: null });
  }

  async has(key: string): Promise<boolean> {
    const entry = this.#store.get(key);
    if (!entry || this.isExpired(entry)) {
      this.#store.delete(key);
      return false;
    }
    return true;
  }

  async forget(key: string): Promise<boolean> {
    return this.#store.delete(key);
  }

  async flush(): Promise<void> {
    this.#store.clear();
  }

  async increment(key: string, by = 1): Promise<number> {
    const current = (await this.get(key)) ?? 0;
    const next = Number(current) + by;
    await this.putForever(key, next);
    return next;
  }

  async decrement(key: string, by = 1): Promise<number> {
    return this.increment(key, -by);
  }

  /** Used by atomic lock implementation. */
  _raw(): Map<string, Entry> {
    return this.#store;
  }
}
