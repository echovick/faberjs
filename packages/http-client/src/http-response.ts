import { HttpClientException } from './http-client-exception.js';

export class HttpResponse {
  constructor(
    private readonly _response: Response,
    private readonly _body: string,
  ) {}

  status(): number {
    return this._response.status;
  }

  ok(): boolean {
    return this._response.status >= 200 && this._response.status <= 299;
  }

  successful(): boolean {
    return this.ok();
  }

  failed(): boolean {
    return !this.ok();
  }

  clientError(): boolean {
    return this._response.status >= 400 && this._response.status <= 499;
  }

  serverError(): boolean {
    return this._response.status >= 500 && this._response.status <= 599;
  }

  redirect(): boolean {
    return this._response.status >= 300 && this._response.status <= 399;
  }

  header(name: string): string | null {
    return this._response.headers.get(name);
  }

  headers(): Record<string, string> {
    const result: Record<string, string> = {};
    this._response.headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  body(): string {
    return this._body;
  }

  json<T = unknown>(): T {
    return JSON.parse(this._body) as T;
  }

  throw(): this {
    if (this.failed()) {
      throw new HttpClientException(this);
    }
    return this;
  }

  throwIf(condition: boolean): this {
    if (condition) {
      throw new HttpClientException(this);
    }
    return this;
  }

  throwUnless(condition: boolean): this {
    if (!condition) {
      throw new HttpClientException(this);
    }
    return this;
  }
}
