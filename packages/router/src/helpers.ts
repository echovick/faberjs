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

function signUrl(url: string): string {
  return createHmac('sha256', appKey()).update(url).digest('hex');
}

export const URL = {
  signedRoute(name: string, params: Record<string, string | number> = {}): string {
    const base = route(name, params);
    const separator = base.includes('?') ? '&' : '?';
    const unsigned = `${base}${separator}_signed=1`;
    const signature = signUrl(unsigned);
    return `${unsigned}&_signature=${signature}`;
  },

  temporarySignedRoute(
    name: string,
    ttlSeconds: number,
    params: Record<string, string | number> = {},
  ): string {
    const base = route(name, params);
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
    const separator = base.includes('?') ? '&' : '?';
    const unsigned = `${base}${separator}_signed=1&_expires=${expiresAt}`;
    const signature = signUrl(unsigned);
    return `${unsigned}&_signature=${signature}`;
  },

  hasValidSignature(requestUrl: string): boolean {
    try {
      const urlObj = new globalThis.URL(
        requestUrl.startsWith('http') ? requestUrl : `http://localhost${requestUrl}`,
      );
      const signature = urlObj.searchParams.get('_signature');
      if (!signature) return false;

      const expires = urlObj.searchParams.get('_expires');
      if (expires && parseInt(expires, 10) < Math.floor(Date.now() / 1000)) return false;

      urlObj.searchParams.delete('_signature');
      const unsigned = urlObj.pathname + (urlObj.search ? urlObj.search : '');
      const expected = signUrl(unsigned);
      return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
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
