import type { Constructor } from '@faberjs/core';
import type { ControllerAction, HttpMethod, RouteDefinition, RouterContract } from '@faberjs/http';
import { RouteBuilder, makeRouteDefinition } from './route-builder';
import type { ResolvedGroup, RouteGroupOptions } from './types';

const RESOURCE_ACTIONS = ['index', 'store', 'show', 'update', 'destroy'] as const;
type ResourceAction = (typeof RESOURCE_ACTIONS)[number];

const RESOURCE_MAP: Record<ResourceAction, { method: HttpMethod; path: string }> = {
  index: { method: 'GET', path: '' },
  store: { method: 'POST', path: '' },
  show: { method: 'GET', path: '/:id' },
  update: { method: 'PUT', path: '/:id' },
  destroy: { method: 'DELETE', path: '/:id' },
};

export class Router implements RouterContract {
  private readonly routes: RouteDefinition[] = [];
  private readonly namedRoutes = new Map<string, RouteDefinition>();
  private readonly groupStack: ResolvedGroup[] = [];

  get(path: string, handler: ControllerAction): RouteBuilder {
    return this.addRoute('GET', path, handler);
  }

  post(path: string, handler: ControllerAction): RouteBuilder {
    return this.addRoute('POST', path, handler);
  }

  put(path: string, handler: ControllerAction): RouteBuilder {
    return this.addRoute('PUT', path, handler);
  }

  patch(path: string, handler: ControllerAction): RouteBuilder {
    return this.addRoute('PATCH', path, handler);
  }

  delete(path: string, handler: ControllerAction): RouteBuilder {
    return this.addRoute('DELETE', path, handler);
  }

  group(options: RouteGroupOptions, callback: () => void): void {
    const parent = this.currentGroup();
    const resolved: ResolvedGroup = {
      prefix: parent.prefix + (options.prefix ?? ''),
      middleware: [...parent.middleware, ...(options.middleware ?? [])],
      name: parent.name + (options.name ?? ''),
    };
    this.groupStack.push(resolved);
    callback();
    this.groupStack.pop();
  }

  resource(name: string, controller: Constructor): void {
    const basePath = `/${name}`;
    for (const action of RESOURCE_ACTIONS) {
      const { method, path } = RESOURCE_MAP[action];
      this.addRoute(method, `${basePath}${path}`, [controller, action]);
    }
  }

  getRoutes(): readonly RouteDefinition[] {
    return this.routes;
  }

  findByName(name: string): RouteDefinition | undefined {
    return this.namedRoutes.get(name);
  }

  private addRoute(method: HttpMethod, path: string, handler: ControllerAction): RouteBuilder {
    const group = this.currentGroup();
    const fullPath = group.prefix + path;
    const definition = makeRouteDefinition(method, fullPath, handler, group.middleware);
    this.routes.push(definition);

    return new RouteBuilder(definition, (routeName, def) => {
      const qualifiedName = group.name + routeName;
      this.namedRoutes.set(qualifiedName, def);
    });
  }

  private currentGroup(): ResolvedGroup {
    return this.groupStack[this.groupStack.length - 1] ?? { prefix: '', middleware: [], name: '' };
  }
}
