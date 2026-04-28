import { Request as FaberRequest, type Response as FaberResponse } from '@faber-js/http';
import type { AdapterOptions, HttpAdapter, RequestHandler } from '../types';

interface BunServer {
  stop(): void;
}

interface BunServeOptions {
  port?: number;
  hostname?: string;
  fetch(req: globalThis.Request): Promise<globalThis.Response>;
}

interface BunGlobal {
  serve(options: BunServeOptions): BunServer;
}

export class BunAdapter implements HttpAdapter {
  private bunServer: BunServer | null = null;

  async start(handler: RequestHandler, options: AdapterOptions = {}): Promise<void> {
    const port = options.port ?? 3000;
    const hostname = options.host ?? '127.0.0.1';

    const Bun = (globalThis as Record<string, unknown>)['Bun'] as BunGlobal | undefined;

    if (Bun === undefined) {
      throw new Error('BunAdapter requires the Bun runtime. Run with `bun run` instead of `node`.');
    }

    this.bunServer = Bun.serve({
      port,
      hostname,
      fetch: async (req: globalThis.Request): Promise<globalThis.Response> => {
        const faberReq = await this.adaptRequest(req);
        const res = await handler(faberReq);
        return this.toWebResponse(res);
      },
    });
  }

  async stop(): Promise<void> {
    this.bunServer?.stop();
    this.bunServer = null;
  }

  private async adaptRequest(req: globalThis.Request): Promise<FaberRequest> {
    const url = new URL(req.url);
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });

    let body: unknown = {};
    const contentType = headers['content-type'] ?? '';
    if (contentType.includes('application/json')) {
      try {
        body = (await req.json()) as unknown;
      } catch {
        body = {};
      }
    }

    return new FaberRequest({
      method: req.method,
      path: url.pathname,
      url: req.url,
      headers,
      body,
      query: Object.fromEntries(url.searchParams.entries()),
      params: {},
      ip: headers['x-forwarded-for'] ?? headers['cf-connecting-ip'] ?? '127.0.0.1',
    });
  }

  private toWebResponse(res: FaberResponse): globalThis.Response {
    const status = res.getStatus();
    const headers = res.getHeaders() as Record<string, string>;
    const body = res.getBody();

    if (body === null) {
      return new globalThis.Response(null, { status, headers });
    }

    if (typeof body === 'object' && body !== null && Symbol.asyncIterator in body) {
      const stream = new ReadableStream({
        async start(controller) {
          for await (const chunk of body as AsyncIterable<string>) {
            controller.enqueue(new TextEncoder().encode(chunk));
          }
          controller.close();
        },
      });
      return new globalThis.Response(stream, { status, headers });
    }

    if (typeof body === 'string') {
      return new globalThis.Response(body, { status, headers });
    }

    return new globalThis.Response(JSON.stringify(body), { status, headers });
  }
}
