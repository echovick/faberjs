import Fastify from 'fastify';
import type { FastifyInstance, FastifyRequest as RawFastifyRequest, FastifyReply } from 'fastify';
import { Request as FaberRequest, type Response as FaberResponse } from '@faber-js/http';
import type { AdapterOptions, HttpAdapter, RequestHandler } from '../types';

export class FastifyAdapter implements HttpAdapter {
  private fastify: FastifyInstance | null = null;

  async start(handler: RequestHandler, options: AdapterOptions = {}): Promise<void> {
    const port = options.port ?? 3000;
    const host = options.host ?? '127.0.0.1';

    this.fastify = Fastify({ logger: false });

    this.fastify.all('*', async (rawReq: RawFastifyRequest, reply: FastifyReply) => {
      const faberReq = this.adaptRequest(rawReq);
      const res = await handler(faberReq);
      await this.sendResponse(reply, res);
    });

    await this.fastify.listen({ port, host });
  }

  async stop(): Promise<void> {
    if (this.fastify !== null) {
      await this.fastify.close();
      this.fastify = null;
    }
  }

  private adaptRequest(rawReq: RawFastifyRequest): FaberRequest {
    const params =
      typeof rawReq.params === 'object' && rawReq.params !== null
        ? (rawReq.params as Record<string, string>)
        : {};
    const query =
      typeof rawReq.query === 'object' && rawReq.query !== null
        ? (rawReq.query as Record<string, string>)
        : {};

    return new FaberRequest({
      method: rawReq.method,
      path: rawReq.url.split('?')[0] ?? rawReq.url,
      url: rawReq.url,
      headers: rawReq.headers as Record<string, string | string[] | undefined>,
      body: rawReq.body,
      query,
      params,
      ip: rawReq.ip,
    });
  }

  private async sendResponse(reply: FastifyReply, res: FaberResponse): Promise<void> {
    const headers = res.getHeaders();
    for (const [key, value] of Object.entries(headers)) {
      void reply.header(key, value);
    }

    const body = res.getBody();

    if (body === null) {
      const contentType = headers['content-type'] ?? '';
      if (contentType.includes('application/json')) {
        await reply.status(res.getStatus()).send('null');
        return;
      }
      await reply.status(res.getStatus()).send();
      return;
    }

    if (typeof body === 'object' && body !== null && Symbol.asyncIterator in body) {
      const { Readable } = await import('node:stream');
      const readable = Readable.from(body as AsyncIterable<string>);
      await reply.status(res.getStatus()).send(readable);
      return;
    }

    await reply.status(res.getStatus()).send(body);
  }
}
