export interface ConfigRepositoryContract {
  get<T = unknown>(key: string, fallback?: T): T | undefined;
  set(key: string, value: unknown): void;
  has(key: string): boolean;
  all(): Record<string, unknown>;
}

export type EnvValue = string | number | boolean | null;
