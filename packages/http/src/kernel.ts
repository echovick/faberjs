import Fastify from 'fastify';
import type { FastifyInstance, FastifyRequest as RawFastifyRequest, FastifyReply } from 'fastify';
import type { ApplicationContract, Constructor } from '@faber-js/core';
import { Request } from './request';
import type { Response } from './response';
import { Pipeline } from './pipeline';
import { HttpException } from './exceptions';
import type {
  ControllerAction,
  ExceptionHandler,
  HttpKernelContract,
  Middleware,
  RouterContract,
} from './types';

export class HttpKernel implements HttpKernelContract {
  private readonly fastify: FastifyInstance;
  private readonly globalMiddleware: Middleware[] = [];
  private readonly namedMiddleware = new Map<string, Middleware>();
  private address = '';

  constructor(private readonly app: ApplicationContract) {
    this.fastify = Fastify({ logger: false });
  }

  use(middleware: Middleware): this {
    this.globalMiddleware.push(middleware);
    return this;
  }

  alias(name: string, middleware: Middleware): this {
    this.namedMiddleware.set(name, middleware);
    return this;
  }

  async listen(port: number, host = '127.0.0.1'): Promise<void> {
    if (this.app.bound('router')) {
      const router = this.app.make<RouterContract>('router');
      this.registerRoutes(router);
    }
    await this.fastify.listen({ port, host });
    const addrs = this.fastify.addresses();
    if (addrs.length > 0) {
      const first = addrs[0];
      this.address = `http://${first.address}:${first.port}`;
    }
  }

  async close(): Promise<void> {
    await this.fastify.close();
  }

  getUrl(): string {
    return this.address;
  }

  private registerRoutes(router: RouterContract): void {
    for (const route of router.getRoutes()) {
      const { method, path, handler, middleware: routeMiddlewareNames } = route;
      this.fastify.route({
        method,
        url: path,
        handler: async (rawReq: RawFastifyRequest, reply: FastifyReply) => {
          const request = this.adaptRequest(rawReq);
          try {
            const routeMiddleware = routeMiddlewareNames
              .map((name) => this.namedMiddleware.get(name))
              .filter((mw): mw is Middleware => mw !== undefined);

            const pipeline = new Pipeline([...this.globalMiddleware, ...routeMiddleware], (req) =>
              this.invokeHandler(handler, req),
            );
            const res = await pipeline.send(request);
            await this.sendResponse(reply, res);
          } catch (error: unknown) {
            await this.handleError(reply, error);
          }
        },
      });
    }
  }

  private adaptRequest(rawReq: RawFastifyRequest): Request {
    const params =
      typeof rawReq.params === 'object' && rawReq.params !== null
        ? (rawReq.params as Record<string, string>)
        : {};
    const query =
      typeof rawReq.query === 'object' && rawReq.query !== null
        ? (rawReq.query as Record<string, string>)
        : {};

    return new Request({
      method: rawReq.method,
      path: rawReq.url.split('?')[0],
      url: rawReq.url,
      headers: rawReq.headers as Record<string, string | string[] | undefined>,
      body: rawReq.body,
      query,
      params,
      ip: rawReq.ip,
    });
  }

  private async invokeHandler(handler: ControllerAction, request: Request): Promise<Response> {
    if (typeof handler === 'function') {
      return handler(request);
    }

    const [ControllerClass, methodName] = handler as readonly [Constructor, string];
    const controller = this.app.make(ControllerClass);
    const record = controller as Record<string, (req: Request) => Promise<Response>>;

    if (typeof record[methodName] !== 'function') {
      throw new Error(`Method [${methodName}] not found on [${ControllerClass.name}].`);
    }

    return record[methodName].call(controller, request);
  }

  private async sendResponse(reply: FastifyReply, res: Response): Promise<void> {
    const headers = res.getHeaders();
    for (const [key, value] of Object.entries(headers)) {
      void reply.header(key, value);
    }

    const body = res.getBody();
    if (body === null) {
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

  private async handleError(reply: FastifyReply, error: unknown): Promise<void> {
    // Allow apps to intercept all errors via a custom exception handler
    if (this.app.bound('exception.handler')) {
      const handler = this.app.make<ExceptionHandler>('exception.handler');
      const response = await Promise.resolve(handler.handle(error));
      if (response !== null) {
        await this.sendResponse(reply, response);
        return;
      }
    }

    if (error instanceof HttpException) {
      const body: Record<string, unknown> = { message: error.message };
      if (error.data !== undefined) {
        body['errors'] = error.data;
      }
      await reply.status(error.statusCode).send(body);
      return;
    }

    // Handle ApplicationException (from @faber-js/core Service helpers) and any
    // error carrying a statusCode property
    if (error instanceof Error && 'statusCode' in error) {
      const statusCode = (error as { statusCode: number }).statusCode;
      const data = (error as { data?: unknown }).data;
      const body: Record<string, unknown> = { message: error.message };
      if (data !== undefined) body['errors'] = data;
      await reply.status(statusCode).send(body);
      return;
    }

    process.stderr.write(
      `\x1b[31mERROR\x1b[0m ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    );
    await reply.status(500).send({ message: 'Internal Server Error' });
  }
}
