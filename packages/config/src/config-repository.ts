import type { ConfigRepositoryContract } from './types';

export class ConfigRepository implements ConfigRepositoryContract {
  private readonly data: Record<string, unknown>;

  constructor(data: Record<string, unknown> = {}) {
    this.data = structuredClone(data);
  }

  get<T = unknown>(key: string, fallback?: T): T | undefined {
    const parts = key.split('.');
    let current: unknown = this.data;

    for (const part of parts) {
      if (current === null || typeof current !== 'object') {
        return fallback;
      }
      current = (current as Record<string, unknown>)[part];
    }

    if (current === undefined) return fallback;
    return current as T;
  }

  set(key: string, value: unknown): void {
    const parts = key.split('.');
    if (parts.length === 0) return;

    let current = this.data;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i] as string;
      if (typeof current[part] !== 'object' || current[part] === null) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    current[parts[parts.length - 1] as string] = value;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  all(): Record<string, unknown> {
    return structuredClone(this.data);
  }

  merge(namespace: string, data: Record<string, unknown>): void {
    this.data[namespace] = data;
  }
}
