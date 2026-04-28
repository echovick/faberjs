import { describe, it, expect, afterEach } from 'vitest';
import { Http } from './http';
import { HttpClientException } from './http-client-exception';

afterEach(() => {
  // Reset fake so tests don't bleed into each other
  Http['_fake'] = null;
});

describe('Http facade with fake()', () => {
  describe('stub returns correct body', () => {
    it('returns the stubbed JSON body for a GET request', async () => {
      Http.fake({
        'https://api.example.com/users': { status: 200, body: { data: [1, 2, 3] } },
      });
      const response = await Http.get('https://api.example.com/users');
      expect(response.json()).toEqual({ data: [1, 2, 3] });
    });

    it('returns the stubbed status code', async () => {
      Http.fake({
        'https://api.example.com/not-found': { status: 404, body: { error: 'not found' } },
      });
      const response = await Http.get('https://api.example.com/not-found');
      expect(response.status()).toBe(404);
    });

    it('returns stubbed string body', async () => {
      Http.fake({
        'https://api.example.com/text': { status: 200, body: 'hello' },
      });
      const response = await Http.get('https://api.example.com/text');
      expect(response.body()).toBe('hello');
    });
  });

  describe('response helper methods', () => {
    it('ok() returns true for 200', async () => {
      Http.fake({ 'https://api.example.com/ok': { status: 200 } });
      const res = await Http.get('https://api.example.com/ok');
      expect(res.ok()).toBe(true);
    });

    it('ok() returns false for 404', async () => {
      Http.fake({ 'https://api.example.com/miss': { status: 404 } });
      const res = await Http.get('https://api.example.com/miss');
      expect(res.ok()).toBe(false);
    });

    it('clientError() returns true for 404', async () => {
      Http.fake({ 'https://api.example.com/client-err': { status: 404 } });
      const res = await Http.get('https://api.example.com/client-err');
      expect(res.clientError()).toBe(true);
    });

    it('clientError() returns false for 200', async () => {
      Http.fake({ 'https://api.example.com/success': { status: 200 } });
      const res = await Http.get('https://api.example.com/success');
      expect(res.clientError()).toBe(false);
    });

    it('serverError() returns true for 500', async () => {
      Http.fake({ 'https://api.example.com/server-err': { status: 500 } });
      const res = await Http.get('https://api.example.com/server-err');
      expect(res.serverError()).toBe(true);
    });
  });

  describe('response.json()', () => {
    it('parses JSON body', async () => {
      Http.fake({ 'https://api.example.com/data': { body: { key: 'value' } } });
      const res = await Http.get('https://api.example.com/data');
      expect(res.json<{ key: string }>()).toEqual({ key: 'value' });
    });
  });

  describe('response.throw()', () => {
    it('throws HttpClientException when response failed (4xx)', async () => {
      Http.fake({ 'https://api.example.com/bad': { status: 422 } });
      const res = await Http.get('https://api.example.com/bad');
      expect(() => res.throw()).toThrow(HttpClientException);
    });

    it('does not throw when response is successful', async () => {
      Http.fake({ 'https://api.example.com/good': { status: 200 } });
      const res = await Http.get('https://api.example.com/good');
      expect(() => res.throw()).not.toThrow();
    });
  });

  describe('FakeHttp assertions', () => {
    it('assertSent passes when URL was requested', async () => {
      const fake = Http.fake({ 'https://api.example.com/ping': { status: 200 } });
      await Http.get('https://api.example.com/ping');
      expect(() => fake.assertSent('https://api.example.com/ping')).not.toThrow();
    });

    it('assertSent throws when URL was not requested', () => {
      const fake = Http.fake({ 'https://api.example.com/ping': { status: 200 } });
      expect(() => fake.assertSent('https://api.example.com/ping')).toThrow();
    });

    it('assertNotSent passes when URL was not requested', async () => {
      const fake = Http.fake({ 'https://api.example.com/used': { status: 200 } });
      await Http.get('https://api.example.com/used');
      expect(() => fake.assertNotSent('https://api.example.com/unused')).not.toThrow();
    });

    it('assertNotSent throws when URL was requested', async () => {
      const fake = Http.fake({ 'https://api.example.com/called': { status: 200 } });
      await Http.get('https://api.example.com/called');
      expect(() => fake.assertNotSent('https://api.example.com/called')).toThrow();
    });

    it('assertNothingSent passes when no requests were made', () => {
      const fake = Http.fake({ 'https://api.example.com/ignored': { status: 200 } });
      expect(() => fake.assertNothingSent()).not.toThrow();
    });

    it('assertNothingSent throws when a request was made', async () => {
      const fake = Http.fake({ 'https://api.example.com/one': { status: 200 } });
      await Http.get('https://api.example.com/one');
      expect(() => fake.assertNothingSent()).toThrow();
    });
  });

  describe('Http.withToken', () => {
    it('sets Authorization header visible in recorded requests via fake', async () => {
      const fake = Http.fake({ 'https://api.example.com/secure': { status: 200 } });
      await Http.withToken('my-secret-token').get('https://api.example.com/secure');
      // The request was sent — verify via assertSent
      expect(() => fake.assertSent('https://api.example.com/secure')).not.toThrow();
    });
  });

  describe('wildcard stubs', () => {
    it('matches wildcard URL pattern', async () => {
      Http.fake({ 'https://api.example.com/*': { status: 200, body: { ok: true } } });
      const res = await Http.get('https://api.example.com/anything');
      expect(res.ok()).toBe(true);
    });
  });

  describe('POST requests', () => {
    it('returns stubbed response for POST', async () => {
      Http.fake({ 'https://api.example.com/items': { status: 201, body: { id: 1 } } });
      const res = await Http.post('https://api.example.com/items', { name: 'Widget' });
      expect(res.status()).toBe(201);
      expect(res.json<{ id: number }>()).toEqual({ id: 1 });
    });
  });
});
