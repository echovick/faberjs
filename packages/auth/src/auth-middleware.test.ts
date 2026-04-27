import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Application } from '@faberjs/core';
import { Request, UnauthorizedException } from '@faberjs/http';
import type { AuthUser } from '@faberjs/http';
import { AuthMiddleware } from './auth-middleware';
import type { GuardContract } from './types';

const alice: AuthUser = { id: 1, email: 'alice@example.com' };

function makeRequest(authHeader?: string): Request {
  return new Request({
    method: 'GET',
    path: '/protected',
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

function makeGuard(user: AuthUser | null): GuardContract {
  return {
    attempt: vi.fn(),
    user: vi.fn().mockResolvedValue(user),
    check: vi.fn().mockResolvedValue(user !== null),
    id: vi.fn().mockResolvedValue(user?.id ?? null),
  };
}

describe('AuthMiddleware', () => {
  let app: Application;

  beforeEach(() => {
    app = new Application();
  });

  afterEach(() => {
    Application.clearInstance();
  });

  describe('handle()', () => {
    it('sets request.user and calls next when token is valid', async () => {
      app.instance('auth.guard', makeGuard(alice));
      const middleware = new AuthMiddleware();
      const req = makeRequest('Bearer valid.token.here');
      const next = vi.fn().mockResolvedValue({ getStatus: () => 200 });

      await middleware.handle(req, next as never);

      expect(req.user).toEqual(alice);
      expect(next).toHaveBeenCalledWith(req);
    });

    it('throws UnauthorizedException when no bearer token is present', async () => {
      app.instance('auth.guard', makeGuard(alice));
      const middleware = new AuthMiddleware();
      const req = makeRequest();
      const next = vi.fn();

      await expect(middleware.handle(req, next as never)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when token is invalid', async () => {
      app.instance('auth.guard', makeGuard(null));
      const middleware = new AuthMiddleware();
      const req = makeRequest('Bearer bad.token');
      const next = vi.fn();

      await expect(middleware.handle(req, next as never)).rejects.toThrow(UnauthorizedException);
    });
  });
});
