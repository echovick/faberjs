import { randomBytes } from 'crypto';

export class Str {
  static camel(value: string): string {
    return Str.studly(value).charAt(0).toLowerCase() + Str.studly(value).slice(1);
  }

  static snake(value: string): string {
    return value
      .replace(/([A-Z])/g, '_$1')
      .replace(/[-\s]+/g, '_')
      .replace(/^_/, '')
      .toLowerCase();
  }

  static kebab(value: string): string {
    return Str.snake(value).replace(/_/g, '-');
  }

  static studly(value: string): string {
    return value
      .replace(/[-_\s]+(.)/g, (_, c: string) => c.toUpperCase())
      .replace(/^(.)/, (_, c: string) => c.toUpperCase());
  }

  static title(value: string): string {
    return value.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  static headline(value: string): string {
    return Str.studly(value)
      .replace(/([A-Z])/g, ' $1')
      .trim();
  }

  static slug(value: string, separator = '-'): string {
    return value
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, separator)
      .replace(new RegExp(`^${separator}|${separator}$`, 'g'), '');
  }

  static contains(haystack: string, needles: string | string[]): boolean {
    const arr = Array.isArray(needles) ? needles : [needles];
    return arr.some((needle) => haystack.includes(needle));
  }

  static containsAll(haystack: string, needles: string[]): boolean {
    return needles.every((needle) => haystack.includes(needle));
  }

  static startsWith(haystack: string, needles: string | string[]): boolean {
    const arr = Array.isArray(needles) ? needles : [needles];
    return arr.some((needle) => haystack.startsWith(needle));
  }

  static endsWith(haystack: string, needles: string | string[]): boolean {
    const arr = Array.isArray(needles) ? needles : [needles];
    return arr.some((needle) => haystack.endsWith(needle));
  }

  static is(pattern: string, value: string): boolean {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp(`^${escaped}$`).test(value);
  }

  static isJson(value: string): boolean {
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  }

  static isUrl(value: string): boolean {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  static isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  static isEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  static after(subject: string, search: string): string {
    const idx = subject.indexOf(search);
    if (idx === -1) return subject;
    return subject.slice(idx + search.length);
  }

  static afterLast(subject: string, search: string): string {
    const idx = subject.lastIndexOf(search);
    if (idx === -1) return subject;
    return subject.slice(idx + search.length);
  }

  static before(subject: string, search: string): string {
    const idx = subject.indexOf(search);
    if (idx === -1) return subject;
    return subject.slice(0, idx);
  }

  static beforeLast(subject: string, search: string): string {
    const idx = subject.lastIndexOf(search);
    if (idx === -1) return subject;
    return subject.slice(0, idx);
  }

  static between(subject: string, from: string, to: string): string {
    return Str.before(Str.after(subject, from), to);
  }

  static limit(value: string, limit: number, end = '...'): string {
    if (value.length <= limit) return value;
    return value.slice(0, limit) + end;
  }

  static words(value: string, words: number, end = '...'): string {
    const wordArr = value.split(/\s+/);
    if (wordArr.length <= words) return value;
    return wordArr.slice(0, words).join(' ') + end;
  }

  static wrap(value: string, before: string, after?: string): string {
    return before + value + (after ?? before);
  }

  static unwrap(value: string, before: string, after?: string): string {
    const aft = after ?? before;
    if (value.startsWith(before) && value.endsWith(aft)) {
      return value.slice(before.length, value.length - aft.length);
    }
    return value;
  }

  static padLeft(value: string, length: number, pad = ' '): string {
    return value.padStart(length, pad);
  }

  static padRight(value: string, length: number, pad = ' '): string {
    return value.padEnd(length, pad);
  }

  static padBoth(value: string, length: number, pad = ' '): string {
    const total = length - value.length;
    if (total <= 0) return value;
    const left = Math.floor(total / 2);
    const right = total - left;
    return (
      pad.repeat(Math.ceil(left / pad.length)).slice(0, left) +
      value +
      pad.repeat(Math.ceil(right / pad.length)).slice(0, right)
    );
  }

  static repeat(str: string, times: number): string {
    return str.repeat(times);
  }

  static remove(search: string | string[], subject: string): string {
    const searches = Array.isArray(search) ? search : [search];
    return searches.reduce((result, s) => result.split(s).join(''), subject);
  }

  static replace(search: string | string[], replace: string | string[], subject: string): string {
    const searches = Array.isArray(search) ? search : [search];
    const replaces = Array.isArray(replace) ? replace : [replace];
    return searches.reduce((result, s, i) => {
      const r = replaces[i] ?? replaces[replaces.length - 1] ?? '';
      return result.split(s).join(r);
    }, subject);
  }

  static replaceFirst(search: string, replace: string, subject: string): string {
    const idx = subject.indexOf(search);
    if (idx === -1) return subject;
    return subject.slice(0, idx) + replace + subject.slice(idx + search.length);
  }

  static replaceLast(search: string, replace: string, subject: string): string {
    const idx = subject.lastIndexOf(search);
    if (idx === -1) return subject;
    return subject.slice(0, idx) + replace + subject.slice(idx + search.length);
  }

  static random(length = 16): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = randomBytes(length);
    return Array.from(bytes)
      .map((b) => chars[b % chars.length])
      .join('');
  }

  static uuid(): string {
    return crypto.randomUUID();
  }

  static ulid(): string {
    const timestamp = Date.now();
    const base32chars = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    let t = timestamp;
    let timePart = '';
    for (let i = 0; i < 10; i++) {
      timePart = base32chars[t % 32] + timePart;
      t = Math.floor(t / 32);
    }
    const randBytes = randomBytes(10);
    const randPart = Array.from(randBytes)
      .map((b) => base32chars[b % 32])
      .join('');
    return timePart + randPart;
  }

  static wordCount(value: string): number {
    const trimmed = value.trim();
    if (trimmed === '') return 0;
    return trimmed.split(/\s+/).length;
  }

  static length(value: string): number {
    return value.length;
  }

  static substr(value: string, start: number, length?: number): string {
    if (length === undefined) return value.slice(start);
    return value.slice(start, start + length);
  }

  static of(value: string): Stringable {
    return new Stringable(value);
  }
}

export class Stringable {
  constructor(private readonly value: string) {}

  camel(): Stringable {
    return new Stringable(Str.camel(this.value));
  }

  snake(): Stringable {
    return new Stringable(Str.snake(this.value));
  }

  kebab(): Stringable {
    return new Stringable(Str.kebab(this.value));
  }

  studly(): Stringable {
    return new Stringable(Str.studly(this.value));
  }

  title(): Stringable {
    return new Stringable(Str.title(this.value));
  }

  slug(separator?: string): Stringable {
    return new Stringable(Str.slug(this.value, separator));
  }

  limit(limit: number, end?: string): Stringable {
    return new Stringable(Str.limit(this.value, limit, end));
  }

  replace(search: string | string[], replace: string | string[]): Stringable {
    return new Stringable(Str.replace(search, replace, this.value));
  }

  trim(): Stringable {
    return new Stringable(this.value.trim());
  }

  upper(): Stringable {
    return new Stringable(this.value.toUpperCase());
  }

  lower(): Stringable {
    return new Stringable(this.value.toLowerCase());
  }

  after(search: string): Stringable {
    return new Stringable(Str.after(this.value, search));
  }

  before(search: string): Stringable {
    return new Stringable(Str.before(this.value, search));
  }

  wrap(before: string, after?: string): Stringable {
    return new Stringable(Str.wrap(this.value, before, after));
  }

  toString(): string {
    return this.value;
  }

  valueOf(): string {
    return this.value;
  }
}
