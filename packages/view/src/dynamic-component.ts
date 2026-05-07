import { raw } from './escape';
import type { RawHtml } from './escape';

export type ComponentFn = (props: Record<string, unknown>) => RawHtml | string;

const componentRegistry = new Map<string, ComponentFn>();

/**
 * Register a component function under a string name so it can be resolved at
 * runtime by `<DynamicComponent component="..." />`.
 */
export function registerComponent(name: string, fn: ComponentFn): void {
  componentRegistry.set(name, fn);
}

/**
 * Look up a registered component by name. Returns undefined when no component
 * is registered.
 */
export function resolveComponent(name: string): ComponentFn | undefined {
  return componentRegistry.get(name);
}

/** Remove all component registrations. Useful for tests. */
export function clearComponents(): void {
  componentRegistry.clear();
}

/**
 * Render a component chosen at runtime. The `component` prop accepts either a
 * direct component function reference or a string name registered via
 * `registerComponent()` / `View.component()`. All other props are forwarded
 * to the resolved component.
 *
 * Mirrors Laravel's `<x-dynamic-component :component="..." />`.
 *
 * @example
 * <DynamicComponent component={isError ? Error : Success} title="Done" />
 *
 * @example
 * View.component('alert', Alert);
 * <DynamicComponent component="alert" type="error">Oops</DynamicComponent>
 */
export function DynamicComponent({
  component,
  ...rest
}: { component: string | ComponentFn } & Record<string, unknown>): RawHtml {
  let fn: ComponentFn | undefined;
  if (typeof component === 'function') {
    fn = component as ComponentFn;
  } else if (typeof component === 'string') {
    fn = componentRegistry.get(component);
    if (!fn) {
      throw new Error(`DynamicComponent: no component registered under the name "${component}"`);
    }
  } else {
    throw new Error('DynamicComponent: `component` prop must be a function or a registered name');
  }

  const result = fn(rest);
  return typeof result === 'string' ? raw(result) : result;
}
