import { raw, RawHtml } from './escape';
import { renderChildren } from './jsx-runtime';
import { getRenderContext } from './render-context';
import type { SessionContext } from './render-context';

// ── Session ───────────────────────────────────────────────────────────

/**
 * Renders children only when the named session value exists. Mirrors Blade's
 * `@session('status') ... @endsession`.
 *
 * Children may be a function `(value: unknown) => unknown` to receive the
 * session value, or static JSX rendered as-is when the key exists.
 *
 * @example
 * <Session name="status">
 *   {(value) => <div class="alert">{String(value)}</div>}
 * </Session>
 *
 * @example
 * <Session name="welcome-shown">
 *   <p>Welcome back!</p>
 * </Session>
 */
export function Session({
  name,
  children,
}: {
  name: string;
  children?: unknown | ((value: unknown) => unknown);
}): RawHtml {
  const ctx = getRenderContext();
  if (!ctx?.session?.has(name)) return raw('');
  if (typeof children === 'function') {
    const value = ctx.session.get(name);
    const out = (children as (value: unknown) => unknown)(value);
    return new RawHtml(renderChildren(out));
  }
  return new RawHtml(renderChildren(children));
}

// ── useSession ────────────────────────────────────────────────────────

/**
 * Returns the current session context, or undefined when no session was set.
 * Use to read multiple keys without nesting `<Session>`.
 */
export function useSession(): SessionContext | undefined {
  return getRenderContext()?.session;
}
