import type { CacheDriver } from './driver';
import { MemoryDriver } from './memory-driver';
import { MemoryLock } from './lock';
import type { CacheLock } from './lock';

export class CacheStore {
  readonly #driver: CacheDriver;

  constructor(driver: CacheDriver) {
    this.#driver = driver;
  }

  async get<T = unknown>(key: string, fallback?: T | (() => Promise<T> | T)): Promise<T | null> {
    const value = await this.#driver.get(key);
    if (value !== null) return value as T;
    if (fallback === undefined) return null;
    const resolved =
      typeof fallback === 'function' ? await (fallback as () => Promise<T>)() : fallback;
    return resolved;
  }

  async put(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.#driver.put(key, value, ttlSeconds);
  }

  async add(key: string, value: unknown, ttlSeconds: number): Promise<boolean> {
    if (await this.#driver.has(key)) return false;
    await this.#driver.put(key, value, ttlSeconds);
    return true;
  }

  async forever(key: string, value: unknown): Promise<void> {
    await this.#driver.putForever(key, value);
  }

  async has(key: string): Promise<boolean> {
    return this.#driver.has(key);
  }

  async missing(key: string): Promise<boolean> {
    return !(await this.#driver.has(key));
  }

  async pull<T = unknown>(key: string): Promise<T | null> {
    const value = await this.get<T>(key);
    if (value !== null) await this.#driver.forget(key);
    return value;
  }

  async forget(key: string): Promise<boolean> {
    return this.#driver.forget(key);
  }

  async flush(): Promise<void> {
    return this.#driver.flush();
  }

  async increment(key: string, by = 1): Promise<number> {
    return this.#driver.increment(key, by);
  }

  async decrement(key: string, by = 1): Promise<number> {
    return this.#driver.decrement(key, by);
  }

  async remember<T>(key: string, ttlSeconds: number, callback: () => Promise<T>): Promise<T> {
    const cached = await this.#driver.get(key);
    if (cached !== null) return cached as T;
    const value = await callback();
    await this.#driver.put(key, value, ttlSeconds);
    return value;
  }

  async rememberForever<T>(key: string, callback: () => Promise<T>): Promise<T> {
    const cached = await this.#driver.get(key);
    if (cached !== null) return cached as T;
    const value = await callback();
    await this.#driver.putForever(key, value);
    return value;
  }

  /**
   * Stale-while-revalidate pattern.
   * [freshSeconds, staleSeconds] — return cached value if within freshSeconds,
   * return stale value (while refreshing in background) if within staleSeconds,
   * otherwise recompute synchronously.
   */
  async flexible<T>(
    key: string,
    [freshTtl, staleTtl]: [number, number],
    callback: () => Promise<T>,
  ): Promise<T> {
    interface FlexEntry {
      value: T;
      cachedAt: number;
      freshUntil: number;
      staleUntil: number;
    }
    const metaKey = `flex:${key}`;
    const raw = (await this.#driver.get(metaKey)) as FlexEntry | null;

    if (raw) {
      const now = Date.now() / 1000;
      if (now < raw.freshUntil) return raw.value;
      if (now < raw.staleUntil) {
        // Refresh in background, return stale
        void (async () => {
          const fresh = await callback();
          const nowTs = Date.now() / 1000;
          await this.#driver.put(
            metaKey,
            {
              value: fresh,
              cachedAt: nowTs,
              freshUntil: nowTs + freshTtl,
              staleUntil: nowTs + staleTtl,
            },
            staleTtl + 60,
          );
        })();
        return raw.value;
      }
    }

    const value = await callback();
    const now = Date.now() / 1000;
    await this.#driver.put(
      metaKey,
      { value, cachedAt: now, freshUntil: now + freshTtl, staleUntil: now + staleTtl },
      staleTtl + 60,
    );
    return value;
  }

  lock(key: string, ttlSeconds = 10): CacheLock {
    if (this.#driver instanceof MemoryDriver) {
      return new MemoryLock(this.#driver, key, ttlSeconds);
    }
    // For Redis driver, fall back to memory lock (full Redis lock in v2)
    throw new Error(
      'Redis atomic locks require ioredis driver. Use memory driver for development.',
    );
  }
}

interface FakeAssertion {
  key: string;
  value?: unknown;
}

class FakeCacheStore extends CacheStore {
  readonly #puts: FakeAssertion[] = [];

  constructor() {
    super(new MemoryDriver());
  }

  override async put(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    this.#puts.push({ key, value });
    return super.put(key, value, ttlSeconds);
  }

  assertPut(key: string, value?: unknown): void {
    const match = this.#puts.find(
      (p) =>
        p.key === key && (value === undefined || JSON.stringify(p.value) === JSON.stringify(value)),
    );
    if (!match)
      throw new Error(`Cache.assertPut: expected key [${key}] to be put, but it was not.`);
  }
}

export class Cache {
  static #store: CacheStore | null = null;
  static #fakeStore: FakeCacheStore | null = null;

  static configure(driver: CacheDriver): void {
    Cache.#store = new CacheStore(driver);
    Cache.#fakeStore = null;
  }

  static fake(): FakeCacheStore {
    Cache.#fakeStore = new FakeCacheStore();
    return Cache.#fakeStore;
  }

  private static store(): CacheStore {
    if (Cache.#fakeStore) return Cache.#fakeStore;
    if (!Cache.#store) {
      Cache.#store = new CacheStore(new MemoryDriver());
    }
    return Cache.#store;
  }

  static async get<T = unknown>(
    key: string,
    fallback?: T | (() => Promise<T> | T),
  ): Promise<T | null> {
    return Cache.store().get(key, fallback);
  }

  static async put(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    return Cache.store().put(key, value, ttlSeconds);
  }

  static async add(key: string, value: unknown, ttlSeconds: number): Promise<boolean> {
    return Cache.store().add(key, value, ttlSeconds);
  }

  static async forever(key: string, value: unknown): Promise<void> {
    return Cache.store().forever(key, value);
  }

  static async has(key: string): Promise<boolean> {
    return Cache.store().has(key);
  }

  static async missing(key: string): Promise<boolean> {
    return Cache.store().missing(key);
  }

  static async pull<T = unknown>(key: string): Promise<T | null> {
    return Cache.store().pull(key);
  }

  static async forget(key: string): Promise<boolean> {
    return Cache.store().forget(key);
  }

  static async flush(): Promise<void> {
    return Cache.store().flush();
  }

  static async increment(key: string, by = 1): Promise<number> {
    return Cache.store().increment(key, by);
  }

  static async decrement(key: string, by = 1): Promise<number> {
    return Cache.store().decrement(key, by);
  }

  static async remember<T>(
    key: string,
    ttlSeconds: number,
    callback: () => Promise<T>,
  ): Promise<T> {
    return Cache.store().remember(key, ttlSeconds, callback);
  }

  static async rememberForever<T>(key: string, callback: () => Promise<T>): Promise<T> {
    return Cache.store().rememberForever(key, callback);
  }

  static async flexible<T>(
    key: string,
    ttls: [number, number],
    callback: () => Promise<T>,
  ): Promise<T> {
    return Cache.store().flexible(key, ttls, callback);
  }

  static lock(key: string, ttlSeconds = 10): CacheLock {
    return Cache.store().lock(key, ttlSeconds);
  }
}
