export interface CacheDriver {
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  putForever(key: string, value: unknown): Promise<void>;
  has(key: string): Promise<boolean>;
  forget(key: string): Promise<boolean>;
  flush(): Promise<void>;
  increment(key: string, by?: number): Promise<number>;
  decrement(key: string, by?: number): Promise<number>;
}
