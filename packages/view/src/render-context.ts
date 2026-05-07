import { AsyncLocalStorage } from 'node:async_hooks';

export class StackManager {
  readonly #stacks = new Map<string, string[]>();

  push(name: string, content: string): void {
    const arr = this.#stacks.get(name) ?? [];
    this.#stacks.set(name, arr);
    arr.push(content);
  }

  prepend(name: string, content: string): void {
    const arr = this.#stacks.get(name) ?? [];
    this.#stacks.set(name, arr);
    arr.unshift(content);
  }

  render(name: string): string {
    return (this.#stacks.get(name) ?? []).join('');
  }

  has(name: string): boolean {
    const s = this.#stacks.get(name);
    return s !== undefined && s.length > 0;
  }
}

export class SectionRegistry {
  readonly #map = new Map<string, string>();

  define(name: string, content: string): void {
    this.#map.set(name, content);
  }

  get(name: string): string | undefined {
    return this.#map.get(name);
  }

  has(name: string): boolean {
    return this.#map.has(name);
  }
}

/**
 * Auth state exposed to views. The auth package populates this on every
 * request; views consume it through `<Auth>` / `<Guest>` and `useAuth()`.
 */
export interface AuthContext {
  /** The authenticated user under the default guard, or undefined. */
  readonly user?: unknown;
  /** Returns true when a user is authenticated under the given guard (default if omitted). */
  check(guard?: string): boolean;
  /** Resolves the user under a specific guard, or undefined. */
  userFor?(guard: string): unknown;
}

/**
 * Session state exposed to views. The session package populates this on every
 * request; views consume it through `<Session>` and `useSession()`.
 */
export interface SessionContext {
  /** Returns true when the given key has a session value. */
  has(key: string): boolean;
  /** Returns the session value for the given key, or undefined. */
  get(key: string): unknown;
}

export interface RenderContextStore {
  readonly stacks: StackManager;
  readonly once: Set<string>;
  readonly sections: SectionRegistry;
  csrf: string;
  errors: Record<string, string | string[]>;
  /**
   * Additional named error bags, keyed by bag name. The default bag remains
   * `errors`. Mirrors Laravel's named error bags (e.g. `@error('email', 'login')`).
   */
  errorBags?: Record<string, Record<string, string | string[]>>;
  auth?: AuthContext;
  session?: SessionContext;
}

const storage = new AsyncLocalStorage<RenderContextStore>();

export function getRenderContext(): RenderContextStore | undefined {
  return storage.getStore();
}

export function createRenderContext(
  overrides: Partial<
    Pick<RenderContextStore, 'csrf' | 'errors' | 'errorBags' | 'auth' | 'session'>
  > = {},
): RenderContextStore {
  const ctx: RenderContextStore = {
    stacks: new StackManager(),
    once: new Set(),
    sections: new SectionRegistry(),
    csrf: overrides.csrf ?? '',
    errors: overrides.errors ?? {},
  };
  if (overrides.errorBags !== undefined) ctx.errorBags = overrides.errorBags;
  if (overrides.auth !== undefined) ctx.auth = overrides.auth;
  if (overrides.session !== undefined) ctx.session = overrides.session;
  return ctx;
}

export function withRenderContext<T>(
  fn: () => T,
  overrides: Partial<
    Pick<RenderContextStore, 'csrf' | 'errors' | 'errorBags' | 'auth' | 'session'>
  > = {},
): T {
  return storage.run(createRenderContext(overrides), fn);
}

export { storage as renderStorage };
