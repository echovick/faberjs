import { raw } from './escape';
import type { RawHtml } from './escape';

const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);

const SENSITIVE_CHARS_RE = new RegExp(`[&<>${LS}${PS}]`, 'g');
const ESCAPE_MAP: Record<string, string> = {
  '&': '\\u0026',
  '<': '\\u003c',
  '>': '\\u003e',
  [LS]: '\\u2028',
  [PS]: '\\u2029',
};

/**
 * Render `value` as a `JSON.parse(...)` call safe for embedding inside HTML.
 * Mirrors Laravel's `Js::from()` helper. The output is a `RawHtml` value so
 * JSX won't double-escape it.
 *
 * The encoding step:
 *   1. JSON.stringify the value.
 *   2. Replace HTML-sensitive characters (&, <, >, U+2028, U+2029) with their
 *      `\\uXXXX` escapes — preventing accidental script-tag breakouts and
 *      JS string-literal line-terminator errors.
 *   3. Wrap the result in `JSON.parse("...")` using `JSON.stringify` on the
 *      string itself for a properly-quoted JS string literal.
 *
 * @example
 * <script>var app = {Js.from({ user: { id: 1 } })};</script>
 * // <script>var app = JSON.parse("{\"user\":{\"id\":1}}");</script>
 */
function jsFrom(value: unknown): RawHtml {
  let json = JSON.stringify(value);
  if (json === undefined) json = 'null';
  json = json.replace(SENSITIVE_CHARS_RE, (ch) => ESCAPE_MAP[ch] ?? ch);
  return raw(`JSON.parse(${JSON.stringify(json)})`);
}

export const Js = {
  from: jsFrom,
};
