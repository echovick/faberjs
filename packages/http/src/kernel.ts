import Fastify from 'fastify';
import type { FastifyInstance, FastifyRequest as RawFastifyRequest, FastifyReply } from 'fastify';
import type { ApplicationContract, Constructor } from '@faber-js/core';
import { Request } from './request';
import { Response } from './response';
import { Pipeline } from './pipeline';
import { HttpException } from './exceptions';
import { runWithRequest } from './request-context';
import type {
  ControllerAction,
  ExceptionHandler,
  HttpKernelContract,
  Middleware,
  RouteDefinition,
  RouterContract,
} from './types';

function matchPathParams(pattern: string, pathname: string): Record<string, string> | null {
  const normalize = (s: string): string => s.replace(/\/$/, '') || '/';
  const patternParts = normalize(pattern).split('/');
  const pathParts = normalize(pathname).split('/');

  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i] ?? '';
    const vp = pathParts[i] ?? '';
    if (pp.startsWith(':')) {
      params[pp.slice(1)] = decodeURIComponent(vp);
    } else if (pp !== vp) {
      return null;
    }
  }
  return params;
}

function matchRoute(
  routes: readonly RouteDefinition[],
  method: string,
  pathname: string,
): { route: RouteDefinition; params: Record<string, string> } | null {
  const upperMethod = method.toUpperCase();
  for (const route of routes) {
    if (route.method !== upperMethod) continue;
    const params = matchPathParams(route.path, pathname);
    if (params !== null) return { route, params };
  }
  return null;
}

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

  register(name: string, middleware: Middleware): this {
    return this.alias(name, middleware);
  }

  pushGlobal(middleware: Middleware): this {
    return this.use(middleware);
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

  async handleRequest(request: Request): Promise<Response> {
    if (!this.app.bound('router')) {
      return Response.notFound('Not Found');
    }

    const router = this.app.make<RouterContract>('router');
    const match = matchRoute(router.getRoutes(), request.method(), request.path());

    if (match === null) {
      return Response.notFound('Route not found');
    }

    const { route, params } = match;
    request.setRouteParams(params);

    const routeMiddleware = route.middleware
      .map((name) => this.namedMiddleware.get(name))
      .filter((mw): mw is Middleware => mw !== undefined);

    const pipeline = new Pipeline([...this.globalMiddleware, ...routeMiddleware], (req) =>
      this.invokeHandler(route.handler, req),
    );

    try {
      return await runWithRequest(request, () => pipeline.send(request));
    } catch (error: unknown) {
      return this.buildErrorResponse(error);
    }
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
            const res = await runWithRequest(request, () => pipeline.send(request));
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
      const contentType = res.getHeaders()['content-type'] ?? '';
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

  private async buildErrorResponse(error: unknown): Promise<Response> {
    if (this.app.bound('exception.handler')) {
      const handler = this.app.make<ExceptionHandler>('exception.handler');
      const response = await Promise.resolve(handler.handle(error));
      if (response !== null) return response;
    }

    if (error instanceof HttpException) {
      const body: Record<string, unknown> = { message: error.message };
      if (error.data !== undefined) body['errors'] = error.data;
      return Response.json(body, error.statusCode);
    }

    if (error instanceof Error && 'statusCode' in error) {
      const statusCode = (error as { statusCode: number }).statusCode;
      const data = (error as { data?: unknown }).data;
      const body: Record<string, unknown> = { message: error.message };
      if (data !== undefined) body['errors'] = data;
      return Response.json(body, statusCode);
    }

    if (error instanceof Error && 'code' in error) {
      const code = (error as { code: string }).code;
      const isUniqueViolation =
        code === 'ER_DUP_ENTRY' ||
        code === 'SQLITE_CONSTRAINT_UNIQUE' ||
        code === 'SQLITE_CONSTRAINT' ||
        code === '23505';
      if (isUniqueViolation) {
        return Response.json({ message: 'A conflicting record already exists.' }, 409);
      }
      if ('errno' in error || 'sqlMessage' in error || 'sql' in error) {
        const logMsg = error instanceof Error ? (error.stack ?? error.message) : String(error);
        this.logError(logMsg);
        return Response.error('Internal Server Error', 500);
      }
    }

    const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
    this.logError(message);
    return Response.error('Internal Server Error', 500);
  }

  private logError(message: string): void {
    if (this.app.bound('log')) {
      const logger = this.app.make<{ error(msg: string): void }>('log');
      logger.error(message);
    } else {
      process.stderr.write(`\x1b[31mERROR\x1b[0m ${message}\n`);
    }
  }

  private async handleError(reply: FastifyReply, error: unknown): Promise<void> {
    const res = await this.buildErrorResponse(error);
    await this.sendResponse(reply, res);
  }
}
