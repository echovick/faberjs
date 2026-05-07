// Custom echo handlers — register a class + formatter so that instances of
// that class get stringified by the formatter when echoed in JSX. Mirrors
// Laravel's `Blade::stringable()` API.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClassRef<T = unknown> = abstract new (...args: any[]) => T;
type Handler<T = unknown> = (value: T) => string;

const handlers: Array<{ cls: ClassRef<unknown>; fn: Handler<unknown> }> = [];

/**
 * Register a custom string formatter for instances of `cls`. When a value
 * passed through `escape()` or rendered as a JSX child is an instance of the
 * registered class, the formatter is called and its return value is escaped
 * and used in place of `String(value)`.
 *
 * Last-registered wins, so callers can override an earlier registration for
 * the same class hierarchy.
 *
 * @example
 * class Money { constructor(readonly amount: number, readonly currency: string) {} }
 * registerStringable(Money, (m) => `${m.amount.toFixed(2)} ${m.currency}`);
 * escape(new Money(12.5, 'USD'));  // → '12.50 USD'
 */
export function registerStringable<T>(cls: ClassRef<T>, fn: (value: T) => string): void {
  handlers.push({
    cls: cls as ClassRef<unknown>,
    fn: fn as Handler<unknown>,
  });
}

/** Remove all registered stringable handlers. Mainly useful for tests. */
export function clearStringables(): void {
  handlers.length = 0;
}

/**
 * Returns the stringified form of `value` from the most-recently-registered
 * matching handler, or undefined when no handler applies.
 */
export function findStringable(value: unknown): string | undefined {
  if (value === null || typeof value !== 'object') return undefined;
  for (let i = handlers.length - 1; i >= 0; i--) {
    const entry = handlers[i];
    if (entry && value instanceof entry.cls) return entry.fn(value);
  }
  return undefined;
}
