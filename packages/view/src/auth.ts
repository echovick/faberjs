import { raw, RawHtml } from './escape';
import { renderChildren } from './jsx-runtime';
import { getRenderContext } from './render-context';
import type { AuthContext } from './render-context';

function isAuthenticated(guard?: string): boolean {
  const ctx = getRenderContext();
  return ctx?.auth?.check(guard) ?? false;
}

// ── Auth ──────────────────────────────────────────────────────────────

/**
 * Renders children only when the current user is authenticated. Equivalent to
 * Blade's `@auth` directive. Pass a `guard` prop to check a specific guard.
 *
 * Reads the auth state from the render context — typically populated by an
 * HTTP middleware that calls `withRenderContext({ auth: ... }, ...)` or by
 * passing `auth` to the renderer's contextOptions.
 *
 * @example
 * <Auth>
 *   <a href="/profile">Profile</a>
 * </Auth>
 *
 * <Auth guard="admin">
 *   <a href="/admin">Admin</a>
 * </Auth>
 */
export function Auth({ guard, children }: { guard?: string; children?: unknown }): RawHtml {
  if (!isAuthenticated(guard)) return raw('');
  return new RawHtml(renderChildren(children));
}

// ── Guest ─────────────────────────────────────────────────────────────

/**
 * Renders children only when the current user is NOT authenticated.
 * Equivalent to Blade's `@guest` directive.
 *
 * @example
 * <Guest>
 *   <a href="/login">Sign in</a>
 * </Guest>
 */
export function Guest({ guard, children }: { guard?: string; children?: unknown }): RawHtml {
  if (isAuthenticated(guard)) return raw('');
  return new RawHtml(renderChildren(children));
}

// ── useAuth ───────────────────────────────────────────────────────────

/**
 * Returns the current auth context, or undefined if no auth was set on the
 * render context. Inside a JSX component you can pull out the user:
 *
 * @example
 * function Header() {
 *   const auth = useAuth();
 *   return auth?.user
 *     ? <p>Hello, {(auth.user as { name: string }).name}</p>
 *     : <p>Welcome, guest</p>;
 * }
 */
export function useAuth(): AuthContext | undefined {
  return getRenderContext()?.auth;
}
