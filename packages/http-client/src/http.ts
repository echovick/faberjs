import { PendingRequest, setHttpFacade } from './pending-request.js';
import { type HttpResponse } from './http-response.js';
import { FakeHttp, type FakeResponse } from './fake-http.js';

export class Http {
  private static _fake: FakeHttp | null = null;

  static {
    setHttpFacade(Http);
  }

  static withHeaders(headers: Record<string, string>): PendingRequest {
    return Http.newPending().withHeaders(headers);
  }

  static withToken(token: string, type?: string): PendingRequest {
    return Http.newPending().withToken(token, type);
  }

  static withBasicAuth(user: string, pass: string): PendingRequest {
    return Http.newPending().withBasicAuth(user, pass);
  }

  static accept(type: string): PendingRequest {
    return Http.newPending().accept(type);
  }

  static acceptJson(): PendingRequest {
    return Http.newPending().acceptJson();
  }

  static asJson(): PendingRequest {
    return Http.newPending().asJson();
  }

  static asForm(): PendingRequest {
    return Http.newPending().asForm();
  }

  static timeout(ms: number): PendingRequest {
    return Http.newPending().timeout(ms);
  }

  static retry(times: number, delay?: number): PendingRequest {
    return Http.newPending().retry(times, delay);
  }

  static baseUrl(url: string): PendingRequest {
    return Http.newPending().baseUrl(url);
  }

  static async get(url: string, params?: Record<string, string | number>): Promise<HttpResponse> {
    return Http.newPending().get(url, params);
  }

  static async post(url: string, data?: unknown): Promise<HttpResponse> {
    return Http.newPending().post(url, data);
  }

  static async put(url: string, data?: unknown): Promise<HttpResponse> {
    return Http.newPending().put(url, data);
  }

  static async patch(url: string, data?: unknown): Promise<HttpResponse> {
    return Http.newPending().patch(url, data);
  }

  static async delete(url: string): Promise<HttpResponse> {
    return Http.newPending().delete(url);
  }

  static fake(stubs?: Record<string, FakeResponse>): FakeHttp {
    Http._fake = new FakeHttp();
    if (stubs) {
      for (const [url, response] of Object.entries(stubs)) {
        Http._fake.stub(url, response);
      }
    }
    return Http._fake;
  }

  static getFake(): FakeHttp | null {
    return Http._fake;
  }

  private static newPending(): PendingRequest {
    return new PendingRequest();
  }
}
