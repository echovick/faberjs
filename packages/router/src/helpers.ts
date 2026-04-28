import { createHmac, timingSafeEqual } from 'node:crypto';
import { Application } from '@faber-js/core';
import type { RouterContract, Middleware, NextFunction, Request, Response } from '@faber-js/http';
import { ForbiddenException } from '@faber-js/http';

export class RouteNotFoundException extends Error {
  constructor(name: string) {
    super(`Route [${name}] is not defined.`);
    this.name = 'RouteNotFoundException';
  }
}

export function route(name: string, params: Record<string, string | number> = {}): string {
  const router = Application.getInstance().make<RouterContract>('router');
  const definition = router.findByName(name);

  if (!definition) {
    throw new RouteNotFoundException(name);
  }

  let url = definition.path;
  for (const [key, value] of Object.entries(params)) {
    url = url.replace(`:${key}`, String(value));
  }
  return url;
}

function appKey(): string {
  const key = process.env['APP_KEY'] ?? '';
  if (!key) throw new Error('APP_KEY is not set. Cannot generate signed URLs.');
  return key;
}

function signUrl(canonical: string): string {
  return createHmac('sha256', appKey()).update(canonical).digest('hex');
}

// Build a canonical signing string: pathname + sorted query params, excluding _signature.
// Using URLSearchParams normalises encoding and sorting removes ordering ambiguity so that
// sign and verify always operate on an identical byte sequence regardless of param order or
// percent-encoding variations in the incoming URL.
function buildCanonical(urlString: string): string {
  const wrapped = urlString.startsWith('http') ? urlString : `http://localhost${urlString}`;
  const urlObj = new globalThis.URL(wrapped);
  urlObj.searchParams.delete('_signature');
  urlObj.searchParams.sort();
  return urlObj.pathname + (urlObj.search || '');
}

export const URL = {
  signedRoute(name: string, params: Record<string, string | number> = {}): string {
    const base = route(name, params);
    const separator = base.includes('?') ? '&' : '?';
    const withSigned = `${base}${separator}_signed=1`;
    const signature = signUrl(buildCanonical(withSigned));
    return `${withSigned}&_signature=${signature}`;
  },

  temporarySignedRoute(
    name: string,
    ttlSeconds: number,
    params: Record<string, string | number> = {},
  ): string {
    const base = route(name, params);
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
    const separator = base.includes('?') ? '&' : '?';
    const withParams = `${base}${separator}_signed=1&_expires=${expiresAt}`;
    const signature = signUrl(buildCanonical(withParams));
    return `${withParams}&_signature=${signature}`;
  },

  hasValidSignature(requestUrl: string): boolean {
    try {
      const wrapped = requestUrl.startsWith('http') ? requestUrl : `http://localhost${requestUrl}`;
      const urlObj = new globalThis.URL(wrapped);
      const signature = urlObj.searchParams.get('_signature');
      if (!signature) return false;

      const expires = urlObj.searchParams.get('_expires');
      if (expires && parseInt(expires, 10) < Math.floor(Date.now() / 1000)) return false;

      const canonical = buildCanonical(requestUrl);
      const expected = signUrl(canonical);

      const sigBuf = Buffer.from(signature, 'hex');
      const expBuf = Buffer.from(expected, 'hex');
      if (sigBuf.length === 0 || sigBuf.length !== expBuf.length) return false;
      return timingSafeEqual(sigBuf, expBuf);
    } catch {
      return false;
    }
  },
};

export class SignedMiddleware implements Middleware {
  async handle(request: Request, next: NextFunction): Promise<Response> {
    const full = request.url();
    if (!URL.hasValidSignature(full)) {
      throw new ForbiddenException('This link is invalid or has expired.');
    }
    return next(request);
  }
}
