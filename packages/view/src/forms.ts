import { raw, escape, RawHtml } from './escape';
import { getRenderContext } from './render-context';
import { renderChildren } from './jsx-runtime';

// ── ValidationErrors ──────────────────────────────────────────────────

export class ValidationErrors {
  readonly #errors: Record<string, string | string[]>;

  constructor(errors: Record<string, string | string[]> = {}) {
    this.#errors = errors;
  }

  /** Returns true if the field has at least one error message. */
  has(field: string): boolean {
    const e = this.#errors[field];
    if (!e) return false;
    return Array.isArray(e) ? e.length > 0 : e.length > 0;
  }

  /** Returns the first error message for the field, or undefined. */
  first(field: string): string | undefined {
    const e = this.#errors[field];
    if (!e) return undefined;
    return Array.isArray(e) ? e[0] : e;
  }

  /** Returns all error messages for the field. */
  all(field: string): string[] {
    const e = this.#errors[field];
    if (!e) return [];
    return Array.isArray(e) ? e : [e];
  }

  isEmpty(): boolean {
    return Object.keys(this.#errors).length === 0;
  }

  isNotEmpty(): boolean {
    return !this.isEmpty();
  }

  /** Returns the underlying errors map. Useful when feeding into another bag. */
  toRecord(): Record<string, string | string[]> {
    return { ...this.#errors };
  }
}

// ── CsrfField ─────────────────────────────────────────────────────────

/**
 * Renders a hidden CSRF token input. Equivalent to Blade's @csrf directive.
 * Reads the token from the render context (set via ViewRenderer options) or
 * from an explicit `token` prop.
 *
 * @example
 * <form method="POST" action="/profile">
 *   <CsrfField />
 * </form>
 */
export function CsrfField({ token }: { token?: string } = {}): RawHtml {
  const ctx = getRenderContext();
  const tok = token ?? ctx?.csrf ?? '';
  return raw(`<input type="hidden" name="_token" value="${escape(tok)}">`);
}

// ── MethodField ───────────────────────────────────────────────────────

/**
 * Renders a hidden `_method` field for HTTP verb spoofing.
 * Equivalent to Blade's @method directive.
 *
 * @example
 * <form method="POST" action="/posts/1">
 *   <MethodField method="PUT" />
 * </form>
 */
export function MethodField({ method }: { method: string }): RawHtml {
  return raw(`<input type="hidden" name="_method" value="${escape(method.toUpperCase())}">`);
}

// ── FieldError ────────────────────────────────────────────────────────

/**
 * Renders validation error content for a named field. Equivalent to Blade's
 * @error directive.
 *
 * Errors are resolved in this priority:
 *  1. Explicit `errors` prop (a ValidationErrors instance or plain object)
 *  2. The named error bag from `ctx.errorBags` when `bag` is provided
 *  3. The default error bag from `ctx.errors`
 *
 * `children` may be a function `(message) => unknown` to receive the first
 * error message, static JSX rendered when an error exists, or omitted to fall
 * back to a default `<p class="faber-error">` element.
 *
 * `fallback` renders when there is NO error for the field — useful for the
 * Blade `@error('email') is-invalid @else is-valid @enderror` pattern.
 *
 * @example
 * <FieldError field="title" />
 *
 * <FieldError field="email" bag="login">
 *   {(msg) => <p class="text-red-500">{msg}</p>}
 * </FieldError>
 *
 * @example  // class-string variant with else fallback
 * <input class={<FieldError field="email" fallback="is-valid">is-invalid</FieldError>} />
 */
export function FieldError({
  field,
  bag: bagName,
  errors: prop,
  children,
  fallback,
}: {
  field: string;
  bag?: string;
  errors?: ValidationErrors | Record<string, string | string[]>;
  children?: unknown | ((message: string) => unknown);
  fallback?: unknown;
}): RawHtml {
  let bag: ValidationErrors;

  if (prop instanceof ValidationErrors) {
    bag = prop;
  } else if (prop && typeof prop === 'object') {
    bag = new ValidationErrors(prop as Record<string, string | string[]>);
  } else {
    const ctx = getRenderContext();
    if (bagName !== undefined) {
      bag = new ValidationErrors(ctx?.errorBags?.[bagName] ?? {});
    } else {
      bag = new ValidationErrors(ctx?.errors ?? {});
    }
  }

  const message = bag.first(field);

  if (!message) {
    if (fallback !== undefined && fallback !== null) {
      return new RawHtml(renderChildren(fallback));
    }
    return raw('');
  }

  if (typeof children === 'function') {
    const out = (children as (msg: string) => unknown)(message);
    return new RawHtml(renderChildren(out));
  }

  if (children !== undefined && children !== null) {
    return new RawHtml(renderChildren(children));
  }

  return raw(`<p class="faber-error">${escape(message)}</p>`);
}
