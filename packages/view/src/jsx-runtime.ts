import { RawHtml, escape } from './escape';
import { AttributeBag } from './attribute-bag';
import { findStringable } from './stringable';

const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

const BOOLEAN_ATTRS = new Set([
  'allowfullscreen',
  'async',
  'autofocus',
  'autoplay',
  'checked',
  'controls',
  'default',
  'defer',
  'disabled',
  'formnovalidate',
  'hidden',
  'ismap',
  'loop',
  'multiple',
  'muted',
  'nomodule',
  'novalidate',
  'open',
  'readonly',
  'required',
  'reversed',
  'selected',
  'typemustmatch',
]);

export function renderChildren(children: unknown): string {
  if (children === null || children === undefined || children === false) return '';
  if (children instanceof RawHtml) return children.html;
  if (children instanceof AttributeBag) return children.toString();
  if (Array.isArray(children)) return (children as unknown[]).map(renderChildren).join('');
  if (typeof children === 'string') return escape(children);
  if (typeof children === 'number') return String(children);
  const customStr = findStringable(children);
  if (customStr !== undefined) return escape(customStr);
  return '';
}

function renderAttrs(props: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(props)) {
    if (key === 'children' || key === 'key') continue;
    if (value === null || value === undefined || value === false) continue;
    const attrName = key === 'className' ? 'class' : key;
    const lower = attrName.toLowerCase();
    if (BOOLEAN_ATTRS.has(lower) && value === true) {
      parts.push(attrName);
    } else {
      parts.push(`${attrName}="${escape(value)}"`);
    }
  }
  return parts.length > 0 ? ' ' + parts.join(' ') : '';
}

type ComponentFn = (props: Record<string, unknown>) => RawHtml | string;
type ElementType = string | ComponentFn;

function render(type: ElementType, props: Record<string, unknown>): RawHtml {
  if (typeof type === 'function') {
    const result = type(props);
    if (result instanceof RawHtml) return result;
    return new RawHtml(result);
  }

  const children = renderChildren(props.children);
  const attrs = renderAttrs(props);

  if (VOID_ELEMENTS.has(type.toLowerCase())) {
    return new RawHtml(`<${type}${attrs}>`);
  }

  return new RawHtml(`<${type}${attrs}>${children}</${type}>`);
}

// New automatic JSX transform — used when jsxImportSource is set
export function jsx(type: ElementType, props: Record<string, unknown>, _key?: string): RawHtml {
  return render(type, props);
}

export function jsxs(type: ElementType, props: Record<string, unknown>, _key?: string): RawHtml {
  return render(type, props);
}

export function jsxDEV(type: ElementType, props: Record<string, unknown>, _key?: string): RawHtml {
  return render(type, props);
}

// Classic JSX transform — used with /** @jsx h */ pragma
export function h(
  type: ElementType,
  props: Record<string, unknown> | null,
  ...children: unknown[]
): RawHtml {
  const normalizedChildren = children.length === 1 ? children[0] : children;
  return render(type, { ...(props ?? {}), children: normalizedChildren });
}

export const Fragment = ({ children }: { children?: unknown }): RawHtml =>
  new RawHtml(renderChildren(children));

export function Unsafe({ html }: { html: string }): RawHtml {
  return new RawHtml(html);
}

// TypeScript JSX type declarations — namespace is required by the JSX transform spec
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace JSX {
  export type Element = RawHtml;
  export interface ElementClass {
    render(): RawHtml;
  }
  // eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
  export interface IntrinsicElements {
    [key: string]: Record<string, unknown>;
  }
}
