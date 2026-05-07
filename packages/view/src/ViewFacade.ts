import { Application } from '@faber-js/core';
import type { ComposerHandler } from './types';
import type { ViewRenderer } from './ViewRenderer';
import { ViewResponse } from './ViewResponse';
import { registerStringable } from './stringable';
import { registerComponent, type ComponentFn } from './dynamic-component';

function renderer(): ViewRenderer {
  return Application.getInstance().make<ViewRenderer>('view.renderer');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClassRef<T = unknown> = abstract new (...args: any[]) => T;

export const View = {
  make(name: string, data: Record<string, unknown> = {}): ViewResponse {
    return new ViewResponse(name, data);
  },

  exists(name: string): boolean {
    return renderer().exists(name);
  },

  first(names: string[], data: Record<string, unknown> = {}): ViewResponse {
    const found = renderer().findFirst(names);
    return new ViewResponse(found, data);
  },

  share(key: string, value: unknown): void {
    renderer().share(key, value);
  },

  composer(views: string | string[], handler: ComposerHandler): void {
    renderer().addComposer(views, handler);
  },

  creator(views: string | string[], handler: ComposerHandler): void {
    renderer().addCreator(views, handler);
  },

  /**
   * Register a custom string formatter for instances of `cls`. Mirrors
   * Laravel's `Blade::stringable()`.
   *
   * @example
   * View.stringable(Money, (m) => m.formatTo('en-GB'));
   */
  stringable<T>(cls: ClassRef<T>, fn: (value: T) => string): void {
    registerStringable(cls, fn);
  },

  /**
   * Register a component function under a string name so it can be looked up
   * at runtime via `<DynamicComponent component="name" />`.
   *
   * @example
   * View.component('alert', Alert);
   */
  component(name: string, fn: ComponentFn): void {
    registerComponent(name, fn);
  },
};
