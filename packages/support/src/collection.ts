export class Collection<T> {
  private readonly items: T[];

  constructor(items: T[] = []) {
    this.items = [...items];
  }

  static make<T>(items: T[] = []): Collection<T> {
    return new Collection<T>(items);
  }

  static times<T>(n: number, fn: (i: number) => T): Collection<T> {
    const items: T[] = [];
    for (let i = 1; i <= n; i++) {
      items.push(fn(i));
    }
    return new Collection<T>(items);
  }

  static range(start: number, end: number): Collection<number> {
    const items: number[] = [];
    for (let i = start; i <= end; i++) {
      items.push(i);
    }
    return new Collection<number>(items);
  }

  all(): T[] {
    return [...this.items];
  }

  toArray(): T[] {
    return this.all();
  }

  first(fn?: (item: T) => boolean): T | undefined {
    if (fn) {
      return this.items.find(fn);
    }
    return this.items[0];
  }

  last(fn?: (item: T) => boolean): T | undefined {
    if (fn) {
      const filtered = this.items.filter(fn);
      return filtered[filtered.length - 1];
    }
    return this.items[this.items.length - 1];
  }

  nth(n: number): T | undefined {
    return this.items[n];
  }

  get count(): number {
    return this.items.length;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  isNotEmpty(): boolean {
    return this.items.length > 0;
  }

  map<U>(fn: (item: T, index: number) => U): Collection<U> {
    return new Collection<U>(this.items.map(fn));
  }

  flatMap<U>(fn: (item: T) => U[]): Collection<U> {
    return new Collection<U>(this.items.flatMap(fn));
  }

  filter(fn: (item: T) => boolean): Collection<T> {
    return new Collection<T>(this.items.filter(fn));
  }

  reject(fn: (item: T) => boolean): Collection<T> {
    return new Collection<T>(this.items.filter((item) => !fn(item)));
  }

  reduce<U>(fn: (carry: U, item: T) => U, initial: U): U {
    return this.items.reduce(fn, initial);
  }

  each(fn: (item: T, index: number) => void): this {
    this.items.forEach(fn);
    return this;
  }

  tap(fn: (collection: Collection<T>) => void): this {
    fn(this);
    return this;
  }

  sort(fn?: (a: T, b: T) => number): Collection<T> {
    return new Collection<T>([...this.items].sort(fn));
  }

  sortBy(key: keyof T): Collection<T> {
    return new Collection<T>(
      [...this.items].sort((a, b) => {
        const av = a[key];
        const bv = b[key];
        if (av < bv) return -1;
        if (av > bv) return 1;
        return 0;
      }),
    );
  }

  sortByDesc(key: keyof T): Collection<T> {
    return new Collection<T>(
      [...this.items].sort((a, b) => {
        const av = a[key];
        const bv = b[key];
        if (av > bv) return -1;
        if (av < bv) return 1;
        return 0;
      }),
    );
  }

  reverse(): Collection<T> {
    return new Collection<T>([...this.items].reverse());
  }

  chunk(size: number): Collection<Collection<T>> {
    const chunks: Array<Collection<T>> = [];
    for (let i = 0; i < this.items.length; i += size) {
      chunks.push(new Collection<T>(this.items.slice(i, i + size)));
    }
    return new Collection<Collection<T>>(chunks);
  }

  groupBy<K extends string | number>(fn: (item: T) => K): Record<K, T[]> {
    const groups = {} as Record<K, T[]>;
    for (const item of this.items) {
      const key = fn(item);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    }
    return groups;
  }

  partition(fn: (item: T) => boolean): [Collection<T>, Collection<T>] {
    const pass: T[] = [];
    const fail: T[] = [];
    for (const item of this.items) {
      if (fn(item)) {
        pass.push(item);
      } else {
        fail.push(item);
      }
    }
    return [new Collection<T>(pass), new Collection<T>(fail)];
  }

  pluck<K extends keyof T>(key: K): Collection<T[K]> {
    return new Collection<T[K]>(this.items.map((item) => item[key]));
  }

  keyBy<K extends keyof T>(key: K): Record<string, T> {
    const result: Record<string, T> = {};
    for (const item of this.items) {
      result[String(item[key])] = item;
    }
    return result;
  }

  unique(fn?: (item: T) => unknown): Collection<T> {
    if (!fn) {
      return new Collection<T>([...new Set(this.items)]);
    }
    const seen = new Set<unknown>();
    return new Collection<T>(
      this.items.filter((item) => {
        const key = fn(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    );
  }

  diff(other: T[] | Collection<T>): Collection<T> {
    const otherArr = other instanceof Collection ? other.all() : other;
    const otherSet = new Set(otherArr);
    return new Collection<T>(this.items.filter((item) => !otherSet.has(item)));
  }

  intersect(other: T[] | Collection<T>): Collection<T> {
    const otherArr = other instanceof Collection ? other.all() : other;
    const otherSet = new Set(otherArr);
    return new Collection<T>(this.items.filter((item) => otherSet.has(item)));
  }

  take(n: number): Collection<T> {
    return new Collection<T>(this.items.slice(0, n));
  }

  skip(n: number): Collection<T> {
    return new Collection<T>(this.items.slice(n));
  }

  slice(start: number, end?: number): Collection<T> {
    return new Collection<T>(this.items.slice(start, end));
  }

  sum(fn?: (item: T) => number): number {
    if (fn) {
      return this.items.reduce((carry, item) => carry + fn(item), 0);
    }
    return (this.items as unknown as number[]).reduce((carry, item) => carry + item, 0);
  }

  avg(fn?: (item: T) => number): number {
    if (this.items.length === 0) return 0;
    return this.sum(fn) / this.items.length;
  }

  min(fn?: (item: T) => number): number | undefined {
    if (this.items.length === 0) return undefined;
    const nums = fn ? this.items.map(fn) : (this.items as unknown as number[]);
    return Math.min(...nums);
  }

  max(fn?: (item: T) => number): number | undefined {
    if (this.items.length === 0) return undefined;
    const nums = fn ? this.items.map(fn) : (this.items as unknown as number[]);
    return Math.max(...nums);
  }

  push(...items: T[]): this {
    (this.items as T[]).push(...items);
    return this;
  }

  prepend(...items: T[]): this {
    (this.items as T[]).unshift(...items);
    return this;
  }

  flatten(): Collection<unknown> {
    return new Collection<unknown>(this.items.flat(Infinity) as unknown[]);
  }

  toJson(): string {
    return JSON.stringify(this.items);
  }

  [Symbol.iterator](): Iterator<T> {
    return this.items[Symbol.iterator]();
  }
}

export function collect<T>(items: T[] = []): Collection<T> {
  return Collection.make<T>(items);
}
