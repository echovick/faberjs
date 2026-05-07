import { escape, raw } from './escape';
import type { RawHtml } from './escape';
import { cls } from './helpers';

/**
 * Sentinel returned by `bag.prepends(...)`. When passed as a default value to
 * `merge()`, the default is prepended to whatever the user supplied for that
 * attribute, instead of being replaced.
 */
export class PrependsValue {
  constructor(readonly value: string) {}
}

type ClassArg =
  | string
  | Record<string, boolean | undefined | null | 0>
  | undefined
  | null
  | false
  | 0;

const CLASS_KEYS = new Set(['class', 'className']);
const ATTRS = Symbol('faber.attrs');

function normalizeKey(key: string): string {
  return key === 'className' ? 'class' : key;
}

function joinClasses(...parts: Array<string | undefined | null | false>): string {
  return parts
    .filter((p): p is string => Boolean(p))
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .join(' ');
}

function normalizeAttrs(input: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    cleaned[normalizeKey(k)] = v;
  }
  return cleaned;
}

/**
 * Holds a bag of HTML attributes passed to a component beyond its declared
 * props. Mirrors Laravel's component attribute bag (`$attributes`) and supports
 * `merge`, `class`, `prepends`, `filter`, `whereStartsWith`, `has`, `only`,
 * `except`, etc.
 *
 * Returned bag instances are spreadable into JSX:
 *
 * ```tsx
 * function Alert({ type, message, ...rest }: AlertProps) {
 *   const attrs = attributeBag(rest);
 *   return (
 *     <div {...attrs.merge({ class: `alert alert-${type}` })}>
 *       {message}
 *     </div>
 *   );
 * }
 * ```
 *
 * Direct echo (`{attrs}`) emits a properly-escaped attribute string, mirroring
 * Blade's `{{ $attributes }}`.
 *
 * Internally backed by a Proxy so attribute keys (e.g. `class`, `merge`) never
 * shadow the prototype methods.
 */
export class AttributeBag {
  // Public index signature — the proxy makes attrs look like own enumerable props
  [key: string]: unknown;

  // Real storage lives behind a symbol so attribute keys can never collide
  // with method names (`class`, `merge`, etc.).
  private [ATTRS]: Record<string, unknown>;

  private constructor(attrs: Record<string, unknown> = {}) {
    this[ATTRS] = normalizeAttrs(attrs);
  }

  static from(attrs: Record<string, unknown> = {}): AttributeBag {
    return new Proxy(new AttributeBag(attrs), PROXY_HANDLER) as AttributeBag;
  }

  /**
   * Merge default attributes. For `class`, the default and existing values are
   * concatenated (default first). For other attributes, the existing value
   * wins unless it is undefined, in which case the default is used. Pass a
   * value wrapped in `bag.prepends(...)` to force prepend semantics on a
   * non-class attribute.
   */
  merge(defaults: Record<string, unknown>): AttributeBag {
    const out = { ...this[ATTRS] };
    for (const [rawKey, defaultValue] of Object.entries(defaults)) {
      const key = normalizeKey(rawKey);
      const existing = out[key];

      if (CLASS_KEYS.has(rawKey) || key === 'class') {
        out[key] = joinClasses(
          typeof defaultValue === 'string' ? defaultValue : String(defaultValue ?? ''),
          typeof existing === 'string' ? existing : String(existing ?? ''),
        );
        continue;
      }

      if (defaultValue instanceof PrependsValue) {
        const incoming = existing === undefined ? '' : String(existing);
        out[key] = incoming ? `${defaultValue.value} ${incoming}` : defaultValue.value;
        continue;
      }

      if (existing === undefined) {
        out[key] = defaultValue;
      }
    }
    return AttributeBag.from(out);
  }

  /**
   * Conditionally merge classes using the same syntax as the `cls()` helper.
   * Equivalent to Laravel's `$attributes->class([...])` — renamed to `classes`
   * because `class` conflicts with the HTML attribute key in JavaScript.
   */
  classes(input: ClassArg | ClassArg[]): AttributeBag {
    const args = Array.isArray(input) ? input : [input];
    const computed = cls(...args);
    const existing = String(this[ATTRS]['class'] ?? '');
    const out = { ...this[ATTRS], class: joinClasses(computed, existing) };
    return AttributeBag.from(out);
  }

  /**
   * Mark a default value as "prepend onto incoming". Use as a value inside
   * `merge()`. Mirrors Laravel's `$attributes->prepends('default')`.
   */
  prepends(value: string): PrependsValue {
    return new PrependsValue(value);
  }

  /** Keep only attributes for which `fn(value, key)` returns true. */
  filter(fn: (value: unknown, key: string) => boolean): AttributeBag {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(this[ATTRS])) {
      if (fn(v, k)) out[k] = v;
    }
    return AttributeBag.from(out);
  }

  /** Keep attributes whose key starts with one of the given prefixes. */
  whereStartsWith(prefix: string | string[]): AttributeBag {
    const ps = Array.isArray(prefix) ? prefix : [prefix];
    return this.filter((_, k) => ps.some((p) => k.startsWith(p)));
  }

  /** Keep attributes whose key does NOT start with any of the given prefixes. */
  whereDoesntStartWith(prefix: string | string[]): AttributeBag {
    const ps = Array.isArray(prefix) ? prefix : [prefix];
    return this.filter((_, k) => !ps.some((p) => k.startsWith(p)));
  }

  /**
   * Returns the value of the first attribute, or undefined when the bag is
   * empty. Useful after `whereStartsWith()` to grab a single match.
   */
  first(): unknown {
    const [head] = Object.entries(this[ATTRS]);
    return head ? head[1] : undefined;
  }

  /**
   * Check whether the bag contains the given attribute key (or all of the
   * given keys if an array is passed).
   */
  has(key: string | string[]): boolean {
    const keys = Array.isArray(key) ? key : [key];
    return keys.every((k) => Object.prototype.hasOwnProperty.call(this[ATTRS], normalizeKey(k)));
  }

  /** Check whether the bag contains any of the given attribute keys. */
  hasAny(keys: string[]): boolean {
    return keys.some((k) => Object.prototype.hasOwnProperty.call(this[ATTRS], normalizeKey(k)));
  }

  /** Get the value of a specific attribute. */
  get(key: string): unknown {
    return this[ATTRS][normalizeKey(key)];
  }

  /** Return a new bag containing only the given keys. */
  only(keys: string[]): AttributeBag {
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      const nk = normalizeKey(k);
      if (Object.prototype.hasOwnProperty.call(this[ATTRS], nk)) {
        out[nk] = this[ATTRS][nk];
      }
    }
    return AttributeBag.from(out);
  }

  /** Return a new bag with the given keys removed. */
  except(keys: string[]): AttributeBag {
    const drop = new Set(keys.map(normalizeKey));
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(this[ATTRS])) {
      if (!drop.has(k)) out[k] = v;
    }
    return AttributeBag.from(out);
  }

  /** True when the bag has no attributes. */
  isEmpty(): boolean {
    return Object.keys(this[ATTRS]).length === 0;
  }

  /** True when the bag has at least one attribute. */
  isNotEmpty(): boolean {
    return !this.isEmpty();
  }

  /**
   * Render the bag as an attribute string suitable for direct interpolation
   * into HTML (with a leading space if non-empty). Equivalent to Blade's
   * `{{ $attributes }}` echo.
   */
  toString(): string {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(this[ATTRS])) {
      if (value === null || value === undefined || value === false) continue;
      if (value === true) {
        parts.push(key);
      } else {
        parts.push(`${key}="${escape(value)}"`);
      }
    }
    return parts.length > 0 ? ' ' + parts.join(' ') : '';
  }

  /** Render the bag to a `RawHtml` instance — used by JSX child rendering. */
  toRawHtml(): RawHtml {
    return raw(this.toString());
  }
}

// Method names — kept reachable on the proxy even when they would otherwise
// be shadowed by an attribute of the same name. (Realistic collisions: none
// in this set; HTML attrs like `class`/`merge` are intentionally omitted so
// they always read as attrs, not methods.)
const METHOD_NAMES = new Set<string>([
  'merge',
  'classes',
  'prepends',
  'filter',
  'whereStartsWith',
  'whereDoesntStartWith',
  'first',
  'has',
  'hasAny',
  'get',
  'only',
  'except',
  'isEmpty',
  'isNotEmpty',
  'toString',
  'toRawHtml',
  'constructor',
]);

// Proxy that exposes `[ATTRS]` as own enumerable props (so JSX `{...bag}` works)
// while keeping a fixed list of method names reachable.
const PROXY_HANDLER: ProxyHandler<AttributeBag> = {
  get(target, prop, receiver) {
    if (typeof prop === 'symbol') {
      return Reflect.get(target, prop, receiver);
    }
    if (METHOD_NAMES.has(prop)) {
      return Reflect.get(target, prop, receiver);
    }
    const attrs = (target as unknown as Record<symbol, Record<string, unknown>>)[ATTRS];
    return attrs[prop];
  },
  has(target, prop) {
    if (typeof prop === 'symbol') return Reflect.has(target, prop);
    if (METHOD_NAMES.has(prop)) return true;
    const attrs = (target as unknown as Record<symbol, Record<string, unknown>>)[ATTRS];
    return Object.prototype.hasOwnProperty.call(attrs, prop);
  },
  ownKeys(target) {
    const attrs = (target as unknown as Record<symbol, Record<string, unknown>>)[ATTRS];
    return Object.keys(attrs);
  },
  getOwnPropertyDescriptor(target, prop) {
    if (typeof prop === 'symbol') return undefined;
    const attrs = (target as unknown as Record<symbol, Record<string, unknown>>)[ATTRS];
    if (Object.prototype.hasOwnProperty.call(attrs, prop)) {
      return {
        enumerable: true,
        configurable: true,
        writable: true,
        value: attrs[prop],
      };
    }
    return undefined;
  },
};

/** Convenience constructor — `attributeBag(rest)` is shorter than `AttributeBag.from(rest)`. */
export function attributeBag(attrs: Record<string, unknown> = {}): AttributeBag {
  return AttributeBag.from(attrs);
}
