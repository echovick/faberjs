import { Application } from '@faberjs/core';
import type { Request } from '@faberjs/http';
import { Response } from '@faberjs/http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Route } from './route';
import type { Router } from './router';
import { RouterServiceProvider } from './router-service-provider';

describe('Route facade', () => {
  let app: Application;

  beforeEach(() => {
    app = new Application();
    app.register(new RouterServiceProvider(app));
  });

  afterEach(() => {
    Application.clearInstance();
  });

  const handler = (_req: Request): Promise<Response> => Promise.resolve(Response.json({}));

  it('get() registers a GET route on the bound router', () => {
    Route.get('/users', handler);
    const router = app.make<Router>('router');
    expect(router.getRoutes()[0]?.method).toBe('GET');
    expect(router.getRoutes()[0]?.path).toBe('/users');
  });

  it('post() registers a POST route', () => {
    Route.post('/users', handler);
    expect(app.make<Router>('router').getRoutes()[0]?.method).toBe('POST');
  });

  it('put() registers a PUT route', () => {
    Route.put('/users/:id', handler);
    expect(app.make<Router>('router').getRoutes()[0]?.method).toBe('PUT');
  });

  it('patch() registers a PATCH route', () => {
    Route.patch('/users/:id', handler);
    expect(app.make<Router>('router').getRoutes()[0]?.method).toBe('PATCH');
  });

  it('delete() registers a DELETE route', () => {
    Route.delete('/users/:id', handler);
    expect(app.make<Router>('router').getRoutes()[0]?.method).toBe('DELETE');
  });

  it('group() applies prefix to all routes inside', () => {
    Route.group({ prefix: '/api' }, () => {
      Route.get('/users', handler);
    });
    expect(app.make<Router>('router').getRoutes()[0]?.path).toBe('/api/users');
  });

  it('returns a RouteBuilder for chaining .name()', () => {
    Route.get('/users', handler).name('users.index');
    expect(app.make<Router>('router').findByName('users.index')).toBeDefined();
  });
});
