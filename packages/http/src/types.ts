import type { Constructor } from '@faber-js/core';
import type { Request } from './request';
import type { Response } from './response';

export type RuntimeName = 'node' | 'bun' | 'lambda' | 'cloudflare';

export interface AdapterOptions {
  readonly port?: number;
  readonly host?: string;
}

export type RequestHandler = (request: Request) => Promise<Response>;

export interface HttpAdapter {
  start(handler: RequestHandler, options?: AdapterOptions): Promise<void>;
  stop(): Promise<void>;
}

export interface AuthUser {
  id: string | number;
  [key: string]: unknown;
}

export interface UploadedFile {
  readonly filename: string;
  readonly mimetype: string;
  readonly size: number;
  toBuffer(): Promise<Buffer>;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type NextFunction = (request: Request) => Promise<Response>;

export interface Middleware {
  handle(request: Request, next: NextFunction): Promise<Response>;
}

export type ControllerAction =
  | readonly [Constructor, string]
  | ((request: Request) => Promise<Response> | Response);

export interface RouteDefinition {
  readonly method: HttpMethod;
  readonly path: string;
  readonly handler: ControllerAction;
  middleware: string[];
  name?: string;
}

export interface RouterContract {
  getRoutes(): readonly RouteDefinition[];
  findByName(name: string): RouteDefinition | undefined;
}

export interface PaginationMeta {
  readonly current_page: number;
  readonly last_page: number;
  readonly per_page: number;
  readonly total: number;
}

export interface PaginationLinks {
  readonly first: string | null;
  readonly last: string | null;
  readonly prev: string | null;
  readonly next: string | null;
}

export interface PaginatedResponse<T = unknown> {
  readonly data: T[];
  readonly meta: PaginationMeta;
  readonly links: PaginationLinks;
}

export interface ExceptionHandler {
  handle(error: unknown): Promise<Response | null> | Response | null;
}

export interface HttpKernelContract {
  use(middleware: Middleware): this;
  alias(name: string, middleware: Middleware): this;
  register(name: string, middleware: Middleware): this;
  pushGlobal(middleware: Middleware): this;
  listen(port: number, host?: string): Promise<void>;
  close(): Promise<void>;
  handleRequest(request: Request): Promise<Response>;
}
