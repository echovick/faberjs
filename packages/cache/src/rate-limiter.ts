import type { CacheDriver } from './driver';

export class RateLimiter {
  static #instance: RateLimiter | null = null;
  readonly #driver: CacheDriver;

  constructor(driver: CacheDriver) {
    this.#driver = driver;
  }

  static configure(driver: CacheDriver): void {
    RateLimiter.#instance = new RateLimiter(driver);
  }

  static getInstance(): RateLimiter {
    if (!RateLimiter.#instance) throw new Error('RateLimiter is not configured.');
    return RateLimiter.#instance;
  }

  static async attempt(
    key: string,
    maxAttempts: number,
    callback: () => Promise<unknown> | unknown,
    decaySeconds = 60,
  ): Promise<boolean> {
    return RateLimiter.getInstance().attempt(key, maxAttempts, callback, decaySeconds);
  }

  static async tooManyAttempts(key: string, maxAttempts: number): Promise<boolean> {
    return RateLimiter.getInstance().tooManyAttempts(key, maxAttempts);
  }

  static async remaining(key: string, maxAttempts: number): Promise<number> {
    return RateLimiter.getInstance().remaining(key, maxAttempts);
  }

  static async increment(key: string, decaySeconds = 60): Promise<number> {
    return RateLimiter.getInstance().increment(key, decaySeconds);
  }

  static async availableIn(key: string): Promise<number> {
    return RateLimiter.getInstance().availableIn(key);
  }

  static async clear(key: string): Promise<void> {
    return RateLimiter.getInstance().clear(key);
  }

  async attempt(
    key: string,
    maxAttempts: number,
    callback: () => Promise<unknown> | unknown,
    decaySeconds = 60,
  ): Promise<boolean> {
    if (await this.tooManyAttempts(key, maxAttempts)) return false;
    await this.increment(key, decaySeconds);
    await callback();
    return true;
  }

  async tooManyAttempts(key: string, maxAttempts: number): Promise<boolean> {
    const hits = Number((await this.#driver.get(`rl:${key}`)) ?? 0);
    return hits >= maxAttempts;
  }

  async remaining(key: string, maxAttempts: number): Promise<number> {
    const hits = Number((await this.#driver.get(`rl:${key}`)) ?? 0);
    return Math.max(0, maxAttempts - hits);
  }

  async increment(key: string, decaySeconds = 60): Promise<number> {
    const timerKey = `rl:${key}:timer`;
    const hasTimer = await this.#driver.has(timerKey);
    if (!hasTimer) {
      await this.#driver.put(timerKey, Math.floor(Date.now() / 1000) + decaySeconds, decaySeconds);
    }
    return this.#driver.increment(`rl:${key}`, 1);
  }

  async availableIn(key: string): Promise<number> {
    const timerKey = `rl:${key}:timer`;
    const expiresAt = Number((await this.#driver.get(timerKey)) ?? 0);
    return Math.max(0, expiresAt - Math.floor(Date.now() / 1000));
  }

  async clear(key: string): Promise<void> {
    await this.#driver.forget(`rl:${key}`);
    await this.#driver.forget(`rl:${key}:timer`);
  }
}
