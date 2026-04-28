import type { HttpAdapter, RuntimeName } from './types';
import { FastifyAdapter } from './fastify/fastify-adapter';
import { BunAdapter } from './bun/bun-adapter';

export type { RuntimeName, AdapterOptions, RequestHandler, HttpAdapter } from './types';

export { FastifyAdapter } from './fastify/fastify-adapter';
export { BunAdapter } from './bun/bun-adapter';
export { createLambdaHandler } from './lambda/lambda-adapter';
export { fromLambdaEvent, toLambdaResponse } from './lambda/event-bridge';
export type { APIGatewayProxyEvent, APIGatewayProxyResult } from './lambda/event-bridge';
export { createWorkerHandler } from './cloudflare/worker-adapter';
export type { WorkerHandler } from './cloudflare/worker-adapter';
export { fromWorkerRequest, toWorkerResponse } from './cloudflare/request-bridge';

export function detectRuntime(): RuntimeName {
  if (
    typeof process !== 'undefined' &&
    typeof process.env === 'object' &&
    process.env['AWS_LAMBDA_FUNCTION_NAME']
  ) {
    return 'lambda';
  }
  if (typeof (globalThis as Record<string, unknown>)['Bun'] !== 'undefined') {
    return 'bun';
  }
  return 'node';
}

export function createAdapter(runtime?: RuntimeName): HttpAdapter {
  const target = runtime ?? detectRuntime();
  if (target === 'bun') return new BunAdapter();
  return new FastifyAdapter();
}
