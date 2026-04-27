import { describe, expect, it } from 'vitest';
import { TokenBudgetMiddleware } from './token-budget-middleware';
import { Request } from '@faberjs/http';
import { Response } from '@faberjs/http';

function makeRequest(): Request {
  return new Request({
    method: 'GET',
    path: '/',
    url: '/',
    headers: {},
    body: null,
    query: {},
    params: {},
  });
}

describe('TokenBudgetMiddleware', () => {
  describe('handle()', () => {
    it('should pass through when budget is not exceeded', async () => {
      const middleware = new TokenBudgetMiddleware({ maxTokens: 1000 });
      const request = makeRequest();
      const expected = Response.json({ ok: true });
      const response = await middleware.handle(request, async () => expected);
      expect(response).toBe(expected);
    });

    it('throws TooManyRequestsException when budget is exceeded', async () => {
      const middleware = new TokenBudgetMiddleware({ maxTokens: 100 });
      middleware.recordTokens(100);
      const request = makeRequest();
      await expect(
        middleware.handle(request, async (_r) => Response.json({ ok: true })),
      ).rejects.toThrow('Token budget exceeded');
    });

    it('throws when used tokens are exactly at maxTokens', async () => {
      const middleware = new TokenBudgetMiddleware({ maxTokens: 50 });
      middleware.recordTokens(50);
      const request = makeRequest();
      await expect(middleware.handle(request, async (_r) => Response.json({}))).rejects.toThrow();
    });
  });

  describe('recordTokens()', () => {
    it('should accumulate token counts', () => {
      const middleware = new TokenBudgetMiddleware({ maxTokens: 1000 });
      middleware.recordTokens(100);
      middleware.recordTokens(200);
      expect(middleware.usedTokens).toBe(300);
    });
  });

  describe('usedTokens', () => {
    it('starts at 0', () => {
      const middleware = new TokenBudgetMiddleware({ maxTokens: 1000 });
      expect(middleware.usedTokens).toBe(0);
    });
  });

  describe('remainingTokens', () => {
    it('returns correct remaining budget', () => {
      const middleware = new TokenBudgetMiddleware({ maxTokens: 500 });
      middleware.recordTokens(200);
      expect(middleware.remainingTokens).toBe(300);
    });

    it('never goes below 0', () => {
      const middleware = new TokenBudgetMiddleware({ maxTokens: 100 });
      middleware.recordTokens(200);
      expect(middleware.remainingTokens).toBe(0);
    });
  });

  describe('reset()', () => {
    it('should reset used tokens to 0', () => {
      const middleware = new TokenBudgetMiddleware({ maxTokens: 1000 });
      middleware.recordTokens(500);
      middleware.reset();
      expect(middleware.usedTokens).toBe(0);
    });

    it('should allow requests again after reset', async () => {
      const middleware = new TokenBudgetMiddleware({ maxTokens: 100 });
      middleware.recordTokens(100);
      middleware.reset();
      const request = makeRequest();
      const expected = Response.json({ ok: true });
      const response = await middleware.handle(request, async () => expected);
      expect(response).toBe(expected);
    });
  });
});
