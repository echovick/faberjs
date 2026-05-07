import { RawHtml } from './escape';
import { renderChildren } from './jsx-runtime';

const S = (name: string): string => `<!--SLOT:${name}:S-->`;
const E = (name: string): string => `<!--SLOT:${name}:E-->`;

const COMMENT_RE = /<!--[\s\S]*?-->/g;

/**
 * A slot value returned by `useSlots()`. Extends `RawHtml` so it interpolates
 * directly in JSX (`{title}`), and adds query helpers that mirror Laravel's
 * `$slot->isEmpty()` and `$slot->hasActualContent()`.
 */
export class SlotValue extends RawHtml {
  /** True when the slot has no characters at all. */
  isEmpty(): boolean {
    return this.html.length === 0;
  }

  /** True when the slot has any non-whitespace characters. */
  hasContent(): boolean {
    return this.html.trim().length > 0;
  }

  /**
   * True when the slot has any non-whitespace characters once HTML comments
   * are stripped — equivalent to Laravel's `$slot->hasActualContent()`.
   */
  hasActualContent(): boolean {
    return this.html.replace(COMMENT_RE, '').trim().length > 0;
  }
}

function slotValue(html: string): SlotValue {
  return new SlotValue(html);
}

/**
 * Marks a named slot region. Use inside a parent component and extract with
 * `useSlots()`. Equivalent to Blade's `<x-slot:name>` syntax.
 *
 * @example
 * <Layout>
 *   <Slot name="title">My Page Title</Slot>
 *   <p>Main body content goes to the default slot.</p>
 * </Layout>
 */
export function Slot({ name, children }: { name: string; children?: unknown }): RawHtml {
  const content = renderChildren(children);
  return slotValue(`${S(name)}${content}${E(name)}`);
}

export interface Slots {
  /** Default (unnamed) slot content — everything not wrapped in a named Slot. */
  readonly slot: SlotValue;
  [name: string]: SlotValue;
}

/**
 * Extracts named slots from rendered children. Call inside a layout component
 * to separate named regions from the default slot content.
 *
 * Multiple `<Slot name="x">` occurrences for the same name are concatenated.
 * Each returned slot is a `SlotValue` that interpolates as raw HTML in JSX
 * and exposes `isEmpty()`, `hasContent()`, and `hasActualContent()`.
 *
 * @example
 * function Layout({ children }: { children?: unknown }) {
 *   const { title, slot } = useSlots(children);
 *   return (
 *     <html>
 *       <head><title>{title.isEmpty() ? 'Untitled' : title}</title></head>
 *       <body>{slot}</body>
 *     </html>
 *   );
 * }
 */
export function useSlots(children: unknown): Slots {
  const html = renderChildren(children);

  const named: Record<string, string> = {};
  const SLOT_RE = /<!--SLOT:([^:]+):S-->([\s\S]*?)<!--SLOT:\1:E-->/g;

  const remaining = html.replace(SLOT_RE, (_, name: string, content: string) => {
    named[name] = (named[name] ?? '') + content;
    return '';
  });

  const slots: Record<string, SlotValue> = { slot: slotValue(remaining) };
  for (const [name, content] of Object.entries(named)) {
    slots[name] = slotValue(content);
  }
  return slots as Slots;
}
