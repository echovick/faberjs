import type { Request, Response } from '@faber-js/http';

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
