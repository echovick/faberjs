export interface CacheLock {
  /** Acquire the lock immediately; returns false if already held. */
  get(): Promise<boolean>;
  /** Acquire the lock immediately and run callback if successful. */
  get<T>(callback: () => Promise<T>): Promise<T | false>;
  /** Block until the lock is acquired or timeout expires. */
  block(seconds: number): Promise<void>;
  /** Block until acquired and run callback. */
  block<T>(seconds: number, callback: () => Promise<T>): Promise<T>;
  release(): Promise<boolean>;
  forceRelease(): Promise<void>;
  owner(): string;
}

import { randomBytes } from 'node:crypto';
import type { MemoryDriver } from './memory-driver';

export class MemoryLock implements CacheLock {
  readonly #driver: MemoryDriver;
  readonly #key: string;
  readonly #ttlSeconds: number;
  readonly #ownerToken: string;

  constructor(driver: MemoryDriver, key: string, ttlSeconds: number) {
    this.#driver = driver;
    this.#key = `lock:${key}`;
    this.#ttlSeconds = ttlSeconds;
    this.#ownerToken = randomBytes(16).toString('hex');
  }

  owner(): string {
    return this.#ownerToken;
  }

  async get(): Promise<boolean>;
  async get<T>(callback?: () => Promise<T>): Promise<T | boolean> {
    const store = this.#driver._raw();
    if (store.has(this.#key)) {
      const entry = store.get(this.#key);
      if (entry !== undefined) {
        const isExpired = entry.expiresAt !== null && entry.expiresAt <= Date.now();
        if (!isExpired) {
          return false;
        }
      }
    }
    await this.#driver.put(this.#key, this.#ownerToken, this.#ttlSeconds);
    if (callback) {
      try {
        return await callback();
      } finally {
        await this.release();
      }
    }
    return true;
  }

  async block(seconds: number): Promise<void>;
  async block<T>(seconds: number, callback?: () => Promise<T>): Promise<T | void> {
    const deadline = Date.now() + seconds * 1000;
    while (Date.now() < deadline) {
      const acquired = await this.get();
      if (acquired) {
        if (callback) {
          try {
            return await callback();
          } finally {
            await this.release();
          }
        }
        return;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`Could not acquire lock [${this.#key}] within ${seconds} seconds.`);
  }

  async release(): Promise<boolean> {
    const current = await this.#driver.get(this.#key);
    if (current !== this.#ownerToken) return false;
    await this.#driver.forget(this.#key);
    return true;
  }

  async forceRelease(): Promise<void> {
    await this.#driver.forget(this.#key);
  }
}
