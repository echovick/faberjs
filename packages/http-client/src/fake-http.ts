import { HttpResponse } from './http-response.js';

export interface FakeResponse {
  status?: number;
  headers?: Record<string, string>;
  body?: unknown;
}

export class FakeHttp {
  #stubs = new Map<string | RegExp, FakeResponse>();
  #recorded: Array<{ url: string; response: HttpResponse }> = [];

  stub(url: string | RegExp, response: FakeResponse): this {
    this.#stubs.set(url, response);
    return this;
  }

  resolve(url: string): HttpResponse | null {
    for (const [pattern, fakeResponse] of this.#stubs) {
      if (this.#matches(pattern, url)) {
        const response = this.#buildResponse(fakeResponse);
        this.#recorded.push({ url, response });
        return response;
      }
    }

    if (this.#stubs.size === 0) {
      return null;
    }

    const defaultResponse = this.#buildResponse({ status: 200, body: '' });
    this.#recorded.push({ url, response: defaultResponse });
    return defaultResponse;
  }

  #matches(pattern: string | RegExp, url: string): boolean {
    if (pattern instanceof RegExp) {
      return pattern.test(url);
    }

    if (pattern === '*') {
      return true;
    }

    if (pattern.includes('*')) {
      const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
      return new RegExp(`^${escaped}$`).test(url);
    }

    return pattern === url;
  }

  #buildResponse(fakeResponse: FakeResponse): HttpResponse {
    const status = fakeResponse.status ?? 200;
    const bodyContent =
      fakeResponse.body !== undefined
        ? typeof fakeResponse.body === 'string'
          ? fakeResponse.body
          : JSON.stringify(fakeResponse.body)
        : '';

    const headers = new Headers({
      'content-type': 'application/json',
      ...(fakeResponse.headers ?? {}),
    });

    const nativeResponse = new Response(bodyContent, { status, headers });
    return new HttpResponse(nativeResponse, bodyContent);
  }

  recorded(): Array<{ url: string; response: HttpResponse }> {
    return this.#recorded;
  }

  assertSent(url: string | RegExp): void {
    const sent = this.#recorded.some((r) => this.#matches(url, r.url));
    if (!sent) {
      throw new Error(`Expected request to ${url.toString()} was not sent.`);
    }
  }

  assertNotSent(url: string | RegExp): void {
    const sent = this.#recorded.some((r) => this.#matches(url, r.url));
    if (sent) {
      throw new Error(`Unexpected request to ${url.toString()} was sent.`);
    }
  }

  assertNothingSent(): void {
    if (this.#recorded.length > 0) {
      throw new Error(`Expected no requests to be sent, but ${this.#recorded.length} were sent.`);
    }
  }
}
