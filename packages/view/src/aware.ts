import { RawHtml } from './escape';
import { renderChildren } from './jsx-runtime';

// JSX evaluates children eagerly, before the parent component function runs.
// To make ancestor-provided values visible inside descendants, the descendants
// must be wrapped in a thunk so that <Aware> can push values onto this stack
// *before* invoking them. Without lazy children, descendants would render
// before the stack frame is established.
//
// The stack is module-scoped because JSX rendering is fully synchronous —
// no awaits happen inside component function bodies.
const awareStack: Array<Record<string, unknown>> = [];

/**
 * Push a frame of aware values. Useful for programmatic scopes that don't go
 * through `<Aware>`. Always pair with `popAware()`.
 */
export function pushAware(values: Record<string, unknown>): void {
  awareStack.push(values);
}

/** Pop the top aware frame. */
export function popAware(): void {
  awareStack.pop();
}

/**
 * Read the nearest value provided for `key` by an ancestor `<Aware>` block,
 * or undefined if none. Mirrors Blade's `@aware([...])` directive.
 */
export function useAware<T = unknown>(key: string): T | undefined {
  for (let i = awareStack.length - 1; i >= 0; i--) {
    const frame = awareStack[i];
    if (frame && Object.prototype.hasOwnProperty.call(frame, key)) {
      return frame[key] as T;
    }
  }
  return undefined;
}

/**
 * Run `fn` with `values` pushed onto the aware stack, returning whatever fn
 * returns. The stack frame is popped before this function returns, even if
 * `fn` throws.
 */
export function provideAware<T>(values: Record<string, unknown>, fn: () => T): T {
  awareStack.push(values);
  try {
    return fn();
  } finally {
    awareStack.pop();
  }
}

/**
 * Provide values to descendant components rendered lazily inside `children`.
 * Equivalent in spirit to Blade's `@aware([...])` and Vue's `provide/inject`.
 *
 * Because JSX evaluates children eagerly, `children` must be a function so
 * that <Aware> can establish the stack frame before descendants render.
 *
 * @example
 * function Menu({ color, children }: { color: string; children: () => unknown }) {
 *   return (
 *     <ul>
 *       <Aware values={{ color }}>{children}</Aware>
 *     </ul>
 *   );
 * }
 *
 * function MenuItem() {
 *   const color = useAware<string>('color') ?? 'gray';
 *   return <li class={`text-${color}-800`}>...</li>;
 * }
 *
 * // Usage:
 * <Menu color="purple">
 *   {() => (
 *     <>
 *       <MenuItem />
 *       <MenuItem />
 *     </>
 *   )}
 * </Menu>
 */
export function Aware({
  values,
  children,
}: {
  values: Record<string, unknown>;
  children?: unknown | (() => unknown);
}): RawHtml {
  awareStack.push(values);
  try {
    const evaluated = typeof children === 'function' ? (children as () => unknown)() : children;
    return new RawHtml(renderChildren(evaluated));
  } finally {
    awareStack.pop();
  }
}
