import { Application } from '@faberjs/core';
import type { Constructor } from '@faberjs/core';
import type { ControllerAction } from '@faberjs/http';
import type { RouteBuilder } from './route-builder';
import type { Router } from './router';
import type { RouteGroupOptions } from './types';

function getRouter(): Router {
  return Application.getInstance().make<Router>('router');
}

export const Route = {
  get(path: string, handler: ControllerAction): RouteBuilder {
    return getRouter().get(path, handler);
  },

  post(path: string, handler: ControllerAction): RouteBuilder {
    return getRouter().post(path, handler);
  },

  put(path: string, handler: ControllerAction): RouteBuilder {
    return getRouter().put(path, handler);
  },

  patch(path: string, handler: ControllerAction): RouteBuilder {
    return getRouter().patch(path, handler);
  },

  delete(path: string, handler: ControllerAction): RouteBuilder {
    return getRouter().delete(path, handler);
  },

  group(options: RouteGroupOptions, callback: () => void): void {
    getRouter().group(options, callback);
  },

  resource(name: string, controller: Constructor): void {
    getRouter().resource(name, controller);
  },
} as const;
