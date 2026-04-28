import type { AuthUser, UploadedFile } from './types';

export interface RequestOptions {
  readonly method: string;
  readonly path: string;
  readonly url?: string;
  readonly headers?: Record<string, string | string[] | undefined>;
  readonly body?: unknown;
  readonly query?: Record<string, string | string[] | undefined>;
  readonly params?: Record<string, string>;
  readonly ip?: string;
}

export class Request {
  public user: AuthUser | null = null;

  readonly #method: string;
  readonly #path: string;
  readonly #url: string;
  readonly #headers: Record<string, string | string[] | undefined>;
  readonly #body: Record<string, unknown>;
  readonly #query: Record<string, string | string[] | undefined>;
  readonly #params: Record<string, string>;
  readonly #ip: string;
  #validated: Record<string, unknown> | null = null;

  constructor(options: RequestOptions) {
    this.#method = options.method.toUpperCase();
    this.#path = options.path;
    this.#url = options.url ?? options.path;
    this.#headers = Request.normalizeHeaders(options.headers ?? {});
    this.#body = Request.parseBody(options.body);
    this.#query = options.query ?? {};
    this.#params = options.params ?? {};
    this.#ip = options.ip ?? '127.0.0.1';
  }

  private static normalizeHeaders(
    headers: Record<string, string | string[] | undefined>,
  ): Record<string, string | string[] | undefined> {
    const normalized: Record<string, string | string[] | undefined> = {};
    for (const [key, value] of Object.entries(headers)) {
      normalized[key.toLowerCase()] = value;
    }
    return normalized;
  }

  private static parseBody(body: unknown): Record<string, unknown> {
    if (body === null || body === undefined) return {};
    if (typeof body === 'object' && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
    return {};
  }

  private get inputData(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(this.#query)) {
      result[key] = value;
    }
    for (const [key, value] of Object.entries(this.#body)) {
      result[key] = value;
    }
    return result;
  }

  input(key: string, fallback?: unknown): unknown {
    const data = this.inputData;
    if (key in data) return data[key];
    return fallback;
  }

  all(): Record<string, unknown> {
    return { ...this.inputData };
  }

  only(...keys: string[]): Record<string, unknown> {
    const data = this.inputData;
    return Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, data[k]]));
  }

  except(...keys: string[]): Record<string, unknown> {
    const data = this.inputData;
    const excluded = new Set(keys);
    return Object.fromEntries(Object.entries(data).filter(([k]) => !excluded.has(k)));
  }

  has(key: string): boolean {
    return key in this.inputData;
  }

  filled(key: string): boolean {
    const value = this.input(key);
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    return true;
  }

  query(): Record<string, string | string[] | undefined>;
  query(key: string): string | string[] | undefined;
  query(key: string, fallback: string): string;
  query(key?: string, fallback?: string | string[]): unknown {
    if (key === undefined) return { ...this.#query };
    const value = this.#query[key];
    return value !== undefined ? value : (fallback ?? null);
  }

  setValidated(data: Record<string, unknown>): void {
    this.#validated = data;
  }

  validated<T = Record<string, unknown>>(): T {
    if (this.#validated === null) {
      throw new Error(
        'Request data has not been validated. Call validate() on a FormRequest first.',
      );
    }
    return this.#validated as T;
  }

  bearerToken(): string | null {
    const authorization = this.header('authorization');
    if (!authorization) return null;
    const match = /^[Bb]earer (.+)$/.exec(authorization);
    return match?.[1] ?? null;
  }

  file(_key: string): UploadedFile {
    throw new Error('File upload support requires multipart integration.');
  }

  isJson(): boolean {
    const contentType = this.header('content-type') ?? '';
    return contentType.includes('application/json');
  }

  wantsJson(): boolean {
    const accept = this.header('accept') ?? '';
    return accept.includes('application/json') || accept.includes('*/*');
  }

  ip(): string {
    return this.#ip;
  }

  header(key: string): string | null {
    const value = this.#headers[key.toLowerCase()]; // keys already normalized in constructor
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
  }

  route(param: string): string {
    return this.#params[param] ?? '';
  }

  method(): string {
    return this.#method;
  }

  path(): string {
    return this.#path;
  }

  url(): string {
    return this.#url;
  }

  params(): Readonly<Record<string, string>> {
    return this.#params;
  }
}
