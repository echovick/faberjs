import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Response } from '@faber-js/http';
import {
  detectRuntime,
  createAdapter,
  FastifyAdapter,
  BunAdapter,
  fromLambdaEvent,
  toLambdaResponse,
  createLambdaHandler,
  fromWorkerRequest,
  toWorkerResponse,
  createWorkerHandler,
} from './index';
import type { APIGatewayProxyEvent } from './lambda/event-bridge';
import type { RequestHandler } from './types';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function jsonResponse(data: unknown, status = 200): Response {
  return Response.json(data, status);
}

const echoHandler: RequestHandler = async (req) => {
  return Response.json({ method: req.method(), path: req.path() });
};

// ────────────────────────────────────────────────────────────────────────────
// detectRuntime
// ────────────────────────────────────────────────────────────────────────────

describe('detectRuntime()', () => {
  it('returns "node" by default', () => {
    delete process.env['AWS_LAMBDA_FUNCTION_NAME'];
    expect(detectRuntime()).toBe('node');
  });

  it('returns "lambda" when AWS_LAMBDA_FUNCTION_NAME is set', () => {
    process.env['AWS_LAMBDA_FUNCTION_NAME'] = 'my-function';
    try {
      expect(detectRuntime()).toBe('lambda');
    } finally {
      delete process.env['AWS_LAMBDA_FUNCTION_NAME'];
    }
  });

  it('returns "bun" when Bun global is present', () => {
    const g = globalThis as Record<string, unknown>;
    g['Bun'] = { serve: () => ({}) };
    try {
      expect(detectRuntime()).toBe('bun');
    } finally {
      delete g['Bun'];
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// createAdapter
// ────────────────────────────────────────────────────────────────────────────

describe('createAdapter()', () => {
  it('returns FastifyAdapter for "node"', () => {
    expect(createAdapter('node')).toBeInstanceOf(FastifyAdapter);
  });

  it('returns BunAdapter for "bun"', () => {
    expect(createAdapter('bun')).toBeInstanceOf(BunAdapter);
  });

  it('returns FastifyAdapter for "lambda"', () => {
    expect(createAdapter('lambda')).toBeInstanceOf(FastifyAdapter);
  });

  it('returns FastifyAdapter for "cloudflare"', () => {
    expect(createAdapter('cloudflare')).toBeInstanceOf(FastifyAdapter);
  });

  it('uses detectRuntime when no argument given', () => {
    delete process.env['AWS_LAMBDA_FUNCTION_NAME'];
    const adapter = createAdapter();
    expect(adapter).toBeInstanceOf(FastifyAdapter);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// FastifyAdapter
// ────────────────────────────────────────────────────────────────────────────

describe('FastifyAdapter', () => {
  let adapter: FastifyAdapter;

  beforeEach(() => {
    adapter = new FastifyAdapter();
  });

  afterEach(async () => {
    await adapter.stop();
  });

  it('starts and accepts requests', async () => {
    const port = 49123;
    await adapter.start(echoHandler, { port, host: '127.0.0.1' });

    const res = await fetch(`http://127.0.0.1:${port}/hello`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { method: string; path: string };
    expect(body.method).toBe('GET');
    expect(body.path).toBe('/hello');
  });

  it('stop() closes the server', async () => {
    const port = 49124;
    await adapter.start(echoHandler, { port, host: '127.0.0.1' });
    await adapter.stop();

    await expect(fetch(`http://127.0.0.1:${port}/`)).rejects.toThrow();
  });

  it('passes handler errors through as 500', async () => {
    const port = 49125;
    const errorHandler: RequestHandler = async () => {
      throw new Error('boom');
    };
    await adapter.start(errorHandler, { port, host: '127.0.0.1' });

    const res = await fetch(`http://127.0.0.1:${port}/any`);
    expect(res.status).toBe(500);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// BunAdapter
// ────────────────────────────────────────────────────────────────────────────

describe('BunAdapter', () => {
  it('throws when Bun runtime is not available', async () => {
    const adapter = new BunAdapter();
    await expect(adapter.start(echoHandler, { port: 49200 })).rejects.toThrow(
      'BunAdapter requires the Bun runtime',
    );
  });

  it('start() and stop() work with mocked Bun global', async () => {
    const stopped = vi.fn();
    const g = globalThis as Record<string, unknown>;
    g['Bun'] = {
      serve: (_opts: unknown) => ({ stop: stopped }),
    };

    try {
      const adapter = new BunAdapter();
      await adapter.start(echoHandler, { port: 49201 });
      await adapter.stop();
      expect(stopped).toHaveBeenCalled();
    } finally {
      delete g['Bun'];
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// fromLambdaEvent
// ────────────────────────────────────────────────────────────────────────────

describe('fromLambdaEvent()', () => {
  const baseEvent: APIGatewayProxyEvent = {
    httpMethod: 'GET',
    path: '/users',
    headers: { 'content-type': 'application/json' },
    multiValueHeaders: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    body: null,
    isBase64Encoded: false,
    requestContext: { identity: { sourceIp: '1.2.3.4' } },
    pathParameters: null,
  };

  it('maps httpMethod and path', () => {
    const req = fromLambdaEvent(baseEvent);
    expect(req.method()).toBe('GET');
    expect(req.path()).toBe('/users');
  });

  it('maps query parameters', () => {
    const req = fromLambdaEvent({ ...baseEvent, queryStringParameters: { page: '2' } });
    expect(req.query('page')).toBe('2');
  });

  it('parses JSON body', () => {
    const req = fromLambdaEvent({
      ...baseEvent,
      httpMethod: 'POST',
      body: '{"name":"Alice"}',
    });
    expect(req.input('name')).toBe('Alice');
  });

  it('handles null headers gracefully', () => {
    const req = fromLambdaEvent({ ...baseEvent, headers: null });
    expect(req.header('content-type')).toBeNull();
  });

  it('maps source IP from requestContext', () => {
    const req = fromLambdaEvent(baseEvent);
    expect(req.ip()).toBe('1.2.3.4');
  });

  it('maps pathParameters', () => {
    const req = fromLambdaEvent({ ...baseEvent, pathParameters: { id: '42' } });
    expect(req.route('id')).toBe('42');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// toLambdaResponse
// ────────────────────────────────────────────────────────────────────────────

describe('toLambdaResponse()', () => {
  it('serializes JSON body', () => {
    const res = jsonResponse({ ok: true });
    const result = toLambdaResponse(res);
    expect(result.statusCode).toBe(200);
    expect(result.body).toBe('{"ok":true}');
    expect(result.isBase64Encoded).toBe(false);
  });

  it('serializes null body as empty string', () => {
    const res = Response.noContent();
    const result = toLambdaResponse(res);
    expect(result.body).toBe('');
    expect(result.statusCode).toBe(204);
  });

  it('passes string body through unchanged', () => {
    const res = Response.html('<h1>Hello</h1>');
    const result = toLambdaResponse(res);
    expect(result.body).toBe('<h1>Hello</h1>');
  });

  it('includes response headers', () => {
    const res = jsonResponse({ x: 1 });
    const result = toLambdaResponse(res);
    expect(result.headers['content-type']).toContain('application/json');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// createLambdaHandler
// ────────────────────────────────────────────────────────────────────────────

describe('createLambdaHandler()', () => {
  const event: APIGatewayProxyEvent = {
    httpMethod: 'GET',
    path: '/ping',
    headers: {},
    multiValueHeaders: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    body: null,
    isBase64Encoded: false,
    requestContext: { identity: { sourceIp: '127.0.0.1' } },
    pathParameters: null,
  };

  it('boots the app on cold start and handles the request', async () => {
    const bootFn = vi.fn().mockResolvedValue(undefined);
    const handleRequest = vi.fn().mockResolvedValue(jsonResponse({ pong: true }));

    const app = {
      boot: bootFn,
      make: vi.fn().mockReturnValue({ handleRequest }),
      bound: vi.fn().mockReturnValue(true),
    };

    const handler = createLambdaHandler(app);
    const result = await handler(event);

    expect(bootFn).toHaveBeenCalledOnce();
    expect(handleRequest).toHaveBeenCalledOnce();
    expect(result.statusCode).toBe(200);
    expect(result.body).toBe('{"pong":true}');
  });

  it('boots only once across multiple invocations', async () => {
    const bootFn = vi.fn().mockResolvedValue(undefined);
    const handleRequest = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));

    const app = {
      boot: bootFn,
      make: vi.fn().mockReturnValue({ handleRequest }),
      bound: vi.fn().mockReturnValue(true),
    };

    const handler = createLambdaHandler(app);
    await handler(event);
    await handler(event);

    expect(bootFn).toHaveBeenCalledOnce();
    expect(handleRequest).toHaveBeenCalledTimes(2);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// fromWorkerRequest
// ────────────────────────────────────────────────────────────────────────────

describe('fromWorkerRequest()', () => {
  it('maps method and path', async () => {
    const req = new globalThis.Request('https://example.com/hello', { method: 'POST' });
    const faberReq = await fromWorkerRequest(req);
    expect(faberReq.method()).toBe('POST');
    expect(faberReq.path()).toBe('/hello');
  });

  it('parses JSON body', async () => {
    const req = new globalThis.Request('https://example.com/data', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: 'value' }),
    });
    const faberReq = await fromWorkerRequest(req);
    expect(faberReq.input('key')).toBe('value');
  });

  it('maps query parameters', async () => {
    const req = new globalThis.Request('https://example.com/search?q=faber');
    const faberReq = await fromWorkerRequest(req);
    expect(faberReq.query('q')).toBe('faber');
  });

  it('extracts IP from cf-connecting-ip header', async () => {
    const req = new globalThis.Request('https://example.com/', {
      headers: { 'cf-connecting-ip': '5.6.7.8' },
    });
    const faberReq = await fromWorkerRequest(req);
    expect(faberReq.ip()).toBe('5.6.7.8');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// toWorkerResponse
// ────────────────────────────────────────────────────────────────────────────

describe('toWorkerResponse()', () => {
  it('converts JSON response', async () => {
    const res = jsonResponse({ hello: 'world' });
    const webRes = toWorkerResponse(res);
    expect(webRes.status).toBe(200);
    const body = (await webRes.json()) as Record<string, string>;
    expect(body.hello).toBe('world');
  });

  it('converts null body response', () => {
    const res = Response.noContent();
    const webRes = toWorkerResponse(res);
    expect(webRes.status).toBe(204);
  });

  it('converts HTML string response', async () => {
    const res = Response.html('<p>test</p>');
    const webRes = toWorkerResponse(res);
    const text = await webRes.text();
    expect(text).toBe('<p>test</p>');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// createWorkerHandler
// ────────────────────────────────────────────────────────────────────────────

describe('createWorkerHandler()', () => {
  it('processes a request through the handler', async () => {
    const handler = createWorkerHandler(async (req) => {
      return Response.json({ path: req.path() });
    });

    const req = new globalThis.Request('https://example.com/test');
    const res = await handler.fetch(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { path: string };
    expect(body.path).toBe('/test');
  });

  it('returns 500 when handler throws', async () => {
    const handler = createWorkerHandler(async () => {
      throw new Error('unexpected error');
    });

    const req = new globalThis.Request('https://example.com/crash');
    const res = await handler.fetch(req);
    expect(res.status).toBe(500);
    const body = (await res.json()) as { message: string };
    expect(body.message).toBe('Internal Server Error');
  });
});
