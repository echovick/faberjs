import { HttpResponse } from './http-response.js';
import type { Http } from './http.js';

type HttpFacade = typeof Http;

let _Http: HttpFacade | null = null;

export function setHttpFacade(facade: HttpFacade): void {
  _Http = facade;
}

export class PendingRequest {
  #baseUrl = '';
  #headers: Record<string, string> = {};
  #timeout = 30_000;
  #retries = 0;
  #retryDelay = 1000;
  #bodyType: 'json' | 'form' | 'multipart' | 'body' = 'json';

  baseUrl(url: string): this {
    this.#baseUrl = url;
    return this;
  }

  withHeaders(headers: Record<string, string>): this {
    this.#headers = { ...this.#headers, ...headers };
    return this;
  }

  withToken(token: string, type = 'Bearer'): this {
    this.#headers['Authorization'] = `${type} ${token}`;
    return this;
  }

  withBasicAuth(user: string, pass: string): this {
    const encoded = Buffer.from(`${user}:${pass}`).toString('base64');
    this.#headers['Authorization'] = `Basic ${encoded}`;
    return this;
  }

  accept(contentType: string): this {
    this.#headers['Accept'] = contentType;
    return this;
  }

  acceptJson(): this {
    return this.accept('application/json');
  }

  contentType(type: string): this {
    this.#headers['Content-Type'] = type;
    return this;
  }

  asJson(): this {
    this.#bodyType = 'json';
    return this.contentType('application/json');
  }

  asForm(): this {
    this.#bodyType = 'form';
    return this.contentType('application/x-www-form-urlencoded');
  }

  timeout(ms: number): this {
    this.#timeout = ms;
    return this;
  }

  retry(times: number, delayMs = 1000): this {
    this.#retries = times;
    this.#retryDelay = delayMs;
    return this;
  }

  withoutVerifying(): this {
    return this;
  }

  async get(url: string, params?: Record<string, string | number>): Promise<HttpResponse> {
    return this.send('GET', url, params);
  }

  async post(url: string, data?: unknown): Promise<HttpResponse> {
    return this.send('POST', url, data);
  }

  async put(url: string, data?: unknown): Promise<HttpResponse> {
    return this.send('PUT', url, data);
  }

  async patch(url: string, data?: unknown): Promise<HttpResponse> {
    return this.send('PATCH', url, data);
  }

  async delete(url: string): Promise<HttpResponse> {
    return this.send('DELETE', url);
  }

  async head(url: string): Promise<HttpResponse> {
    return this.send('HEAD', url);
  }

  async send(method: string, url: string, data?: unknown): Promise<HttpResponse> {
    const fullUrl = this.#resolveUrl(url);
    const isGetOrHead = method === 'GET' || method === 'HEAD';

    let resolvedUrl = fullUrl;
    if (isGetOrHead && data && typeof data === 'object') {
      const params = data as Record<string, string | number>;
      const entries: Record<string, string> = {};
      for (const [k, v] of Object.entries(params)) {
        entries[k] = String(v);
      }
      const qs = new URLSearchParams(entries).toString();
      resolvedUrl = qs ? `${fullUrl}${fullUrl.includes('?') ? '&' : '?'}${qs}` : fullUrl;
    }

    if (_Http !== null) {
      const fake = _Http.getFake();
      if (fake !== null) {
        const fakeResponse = fake.resolve(resolvedUrl);
        if (fakeResponse !== null) {
          return fakeResponse;
        }
        throw new Error(`No stub for URL ${resolvedUrl}`);
      }
    }

    let body: string | undefined;
    if (!isGetOrHead && data !== undefined) {
      if (this.#bodyType === 'form') {
        const formEntries: Record<string, string> = {};
        for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
          formEntries[k] = String(v);
        }
        body = new URLSearchParams(formEntries).toString();
      } else {
        body = JSON.stringify(data);
        if (!this.#headers['Content-Type']) {
          this.#headers['Content-Type'] = 'application/json';
        }
      }
    }

    const maxAttempts = this.#retries + 1;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.#timeout);

        let nativeResponse: Response;
        try {
          const init: RequestInit = {
            method,
            headers: this.#headers,
            signal: controller.signal,
          };
          if (body !== undefined) {
            init.body = body;
          }
          nativeResponse = await fetch(resolvedUrl, init);
        } finally {
          clearTimeout(timer);
        }

        const text = await nativeResponse.text();
        return new HttpResponse(nativeResponse, text);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < maxAttempts) {
          await new Promise<void>((resolve) => setTimeout(resolve, this.#retryDelay));
        }
      }
    }

    throw lastError ?? new Error('Request failed');
  }

  #resolveUrl(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `${this.#baseUrl}${url}`;
  }
}
