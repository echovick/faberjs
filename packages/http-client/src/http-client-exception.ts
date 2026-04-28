import type { HttpResponse } from './http-response.js';

export class HttpClientException extends Error {
  constructor(public readonly response: HttpResponse) {
    super(`HTTP request failed with status ${response.status()}`);
    this.name = 'HttpClientException';
  }
}
