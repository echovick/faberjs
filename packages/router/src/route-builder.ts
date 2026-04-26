import type { ControllerAction, HttpMethod, RouteDefinition } from '@faberjs/http';

export class RouteBuilder {
  readonly #definition: RouteDefinition;
  readonly #onName: (name: string, definition: RouteDefinition) => void;

  constructor(
    definition: RouteDefinition,
    onName: (name: string, definition: RouteDefinition) => void,
  ) {
    this.#definition = definition;
    this.#onName = onName;
  }

  name(routeName: string): this {
    this.#definition.name = routeName;
    this.#onName(routeName, this.#definition);
    return this;
  }

  getDefinition(): RouteDefinition {
    return this.#definition;
  }
}

export function makeRouteDefinition(
  method: HttpMethod,
  path: string,
  handler: ControllerAction,
  middleware: readonly string[],
): RouteDefinition {
  return { method, path, handler, middleware };
}
