import { findStringable } from './stringable';

export class RawHtml {
  constructor(readonly html: string) {}
}

export function raw(html: string): RawHtml {
  return new RawHtml(html);
}

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function htmlEscape(str: string): string {
  return str.replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch] ?? ch);
}

export function escape(value: unknown): string {
  if (value === null || value === undefined || value === false) return '';
  if (value instanceof RawHtml) return value.html;
  const customStr = findStringable(value);
  if (customStr !== undefined) return htmlEscape(customStr);
  return htmlEscape(String(value));
}
