import { describe, it, expect, vi } from 'vitest';
import { Request, Response } from '@faber-js/http';
import { SharedData } from './SharedData';
import { BridgeMiddleware } from './BridgeMiddleware';
import { BridgeController } from './BridgeController';
import { extractBridgeMeta } from './internal';

function makeRequest(
  overrides: Partial<{
    path: string;
    url: string;
    headers: Record<string, string>;
  }> = {},
): Request {
  return new Request({
    method: 'GET',
    path: overrides.path ?? '/test',
    url: overrides.url ?? '/test',
    headers: overrides.headers ?? {},
  });
}

function makeMiddleware(sharedData?: SharedData, version = '', rootView = ''): BridgeMiddleware {
  return new BridgeMiddleware(sharedData ?? new SharedData(), {
    version,
    rootView,
  });
}

// Concrete BridgeController for testing
class TestController extends BridgeController {
  testRender(component: string, props: Record<string, unknown> = {}): Response {
    return this.render(component, props);
  }
}

describe('BridgeController', () => {
  describe('render()', () => {
    it('creates a response whose body is marked as a bridge render', () => {
      const controller = new TestController();
      const response = controller.testRender('Users/Index', { users: [] });

      expect(response.getStatus()).toBe(200);
      const meta = extractBridgeMeta(response);
      expect(meta).toBeDefined();
      expect(meta?.component).toBe('Users/Index');
      expect(meta?.rawProps).toEqual({ users: [] });
    });

    it('defaults to empty props when none provided', () => {
      const controller = new TestController();
      const response = controller.testRender('Dashboard');
      const meta = extractBridgeMeta(response);
      expect(meta?.rawProps).toEqual({});
    });

    it('body serialises to empty object (marker is a symbol — not included in JSON)', () => {
      const controller = new TestController();
      const response = controller.testRender('Users/Index', { secret: true });
      expect(JSON.stringify(response.getBody())).toBe('{}');
    });
  });
});

describe('SharedData', () => {
  describe('share()', () => {
    it('merges static key/value into every response', async () => {
      const shared = new SharedData();
      shared.share('appName', 'FaberJS');
      const req = makeRequest();
      const data = await shared.all(req);
      expect(data).toEqual({ appName: 'FaberJS' });
    });

    it('merges provider function result', async () => {
      const shared = new SharedData();
      shared.share(() => ({ locale: 'en' }));
      const req = makeRequest();
      const data = await shared.all(req);
      expect(data).toEqual({ locale: 'en' });
    });

    it('merges async provider', async () => {
      const shared = new SharedData();
      shared.share(async () => ({ user: { id: 1 } }));
      const req = makeRequest();
      const data = await shared.all(req);
      expect(data).toEqual({ user: { id: 1 } });
    });

    it('merges multiple providers in registration order', async () => {
      const shared = new SharedData();
      shared.share('a', 1);
      shared.share(() => ({ b: 2 }));
      const data = await shared.all(makeRequest());
      expect(data).toEqual({ a: 1, b: 2 });
    });

    it('returns empty object when no providers registered', async () => {
      const shared = new SharedData();
      const data = await shared.all(makeRequest());
      expect(data).toEqual({});
    });
  });
});

describe('BridgeMiddleware', () => {
  describe('handle()', () => {
    it('passes non-bridge responses through unchanged', async () => {
      const mw = makeMiddleware();
      const original = Response.json({ message: 'ok' });
      const next = vi.fn().mockResolvedValue(original);
      const result = await mw.handle(makeRequest(), next);
      expect(result).toBe(original);
    });

    it('returns bridge JSON for XHR requests with X-Faber-Bridge header', async () => {
      const mw = makeMiddleware();
      const controller = new TestController();
      const bridgeResponse = controller.testRender('Users/Index', { users: [] });
      const next = vi.fn().mockResolvedValue(bridgeResponse);

      const req = makeRequest({ headers: { 'x-faber-bridge': 'true' } });
      const result = await mw.handle(req, next);

      expect(result.getStatus()).toBe(200);
      expect(result.getHeaders()['x-faber-bridge']).toBe('true');
      expect(result.getHeaders()['vary']).toBe('x-faber-bridge');

      const body = result.getBody() as Record<string, unknown>;
      expect(body['component']).toBe('Users/Index');
      expect(body['props']).toEqual({ users: [] });
      expect(body['url']).toBe('/test');
    });

    it('merges SharedData into bridge XHR response props', async () => {
      const shared = new SharedData();
      shared.share('locale', 'en');
      const mw = makeMiddleware(shared);
      const controller = new TestController();
      const next = vi.fn().mockResolvedValue(controller.testRender('Dashboard', { count: 5 }));

      const req = makeRequest({ headers: { 'x-faber-bridge': 'true' } });
      const result = await mw.handle(req, next);
      const body = result.getBody() as Record<string, unknown>;

      expect(body['props']).toEqual({ locale: 'en', count: 5 });
    });

    it('returns HTML for full-page (non-XHR) requests', async () => {
      const mw = makeMiddleware();
      const controller = new TestController();
      const next = vi.fn().mockResolvedValue(controller.testRender('Users/Index', {}));

      const result = await mw.handle(makeRequest(), next);

      expect(result.getHeaders()['content-type']).toBe('text/html; charset=utf-8');
      const body = result.getBody() as string;
      expect(body).toContain('data-page=');
      expect(body).toContain('Users/Index');
    });

    it('returns 409 with location header on version mismatch for XHR', async () => {
      const mw = makeMiddleware(new SharedData(), 'v2');
      const controller = new TestController();
      const next = vi.fn().mockResolvedValue(controller.testRender('Dashboard'));

      const req = makeRequest({
        headers: { 'x-faber-bridge': 'true', 'x-faber-bridge-version': 'v1' },
      });
      const result = await mw.handle(req, next);

      expect(result.getStatus()).toBe(409);
      expect(result.getHeaders()['x-faber-bridge-location']).toBe('/test');
    });

    it('does not 409 when versions match', async () => {
      const mw = makeMiddleware(new SharedData(), 'v2');
      const controller = new TestController();
      const next = vi.fn().mockResolvedValue(controller.testRender('Dashboard'));

      const req = makeRequest({
        headers: { 'x-faber-bridge': 'true', 'x-faber-bridge-version': 'v2' },
      });
      const result = await mw.handle(req, next);

      expect(result.getStatus()).toBe(200);
    });

    it('HTML does not contain raw single-quotes in data-page JSON (XSS guard)', async () => {
      const mw = makeMiddleware();
      const controller = new TestController();
      const next = vi.fn().mockResolvedValue(controller.testRender('Page', { value: "it's here" }));

      const result = await mw.handle(makeRequest(), next);
      const body = result.getBody() as string;
      expect(body).not.toContain("'");
    });
  });
});
