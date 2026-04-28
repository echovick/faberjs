export class Arr {
  static wrap<T>(value: T | T[]): T[] {
    if (Array.isArray(value)) return value;
    return [value];
  }

  static flatten<T>(array: unknown[], depth = Infinity): T[] {
    return array.flat(depth) as T[];
  }

  static compact<T>(array: Array<T | null | undefined | false>): T[] {
    return array.filter((item): item is T => Boolean(item));
  }

  static unique<T>(array: T[]): T[] {
    return [...new Set(array)];
  }

  static chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  static first<T>(array: T[]): T | undefined {
    return array[0];
  }

  static last<T>(array: T[]): T | undefined {
    return array[array.length - 1];
  }

  static random<T>(array: T[]): T | undefined {
    if (array.length === 0) return undefined;
    return array[Math.floor(Math.random() * array.length)];
  }

  static shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j] as T, result[i] as T];
    }
    return result;
  }

  static pluck<T, K extends keyof T>(array: T[], key: K): Array<T[K]> {
    return array.map((item) => item[key]);
  }

  static keyBy<T, K extends keyof T>(array: T[], key: K): Record<string, T> {
    const result: Record<string, T> = {};
    for (const item of array) {
      result[String(item[key])] = item;
    }
    return result;
  }

  static groupBy<T>(array: T[], key: keyof T | ((item: T) => string)): Record<string, T[]> {
    const result: Record<string, T[]> = {};
    for (const item of array) {
      const k = typeof key === 'function' ? key(item) : String(item[key]);
      if (!result[k]) result[k] = [];
      result[k].push(item);
    }
    return result;
  }

  static sum(array: number[]): number {
    return array.reduce((carry, n) => carry + n, 0);
  }

  static avg(array: number[]): number {
    if (array.length === 0) return 0;
    return Arr.sum(array) / array.length;
  }

  static min(array: number[]): number | undefined {
    if (array.length === 0) return undefined;
    return Math.min(...array);
  }

  static max(array: number[]): number | undefined {
    if (array.length === 0) return undefined;
    return Math.max(...array);
  }

  static diff<T>(array: T[], ...others: T[][]): T[] {
    const otherSet = new Set(others.flat());
    return array.filter((item) => !otherSet.has(item));
  }

  static intersect<T>(array: T[], ...others: T[][]): T[] {
    const sets = others.map((o) => new Set(o));
    return array.filter((item) => sets.every((s) => s.has(item)));
  }

  static zip<A, B>(a: A[], b: B[]): Array<[A, B]> {
    const length = Math.min(a.length, b.length);
    const result: Array<[A, B]> = [];
    for (let i = 0; i < length; i++) {
      result.push([a[i] as A, b[i] as B]);
    }
    return result;
  }

  static range(start: number, end: number, step = 1): number[] {
    const result: number[] = [];
    for (let i = start; i <= end; i += step) {
      result.push(i);
    }
    return result;
  }

  static sortBy<T>(array: T[], key: keyof T, direction: 'asc' | 'desc' = 'asc'): T[] {
    return [...array].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      let cmp = 0;
      if (av < bv) cmp = -1;
      else if (av > bv) cmp = 1;
      return direction === 'desc' ? -cmp : cmp;
    });
  }

  static except<T extends object>(obj: T, keys: Array<keyof T>): Partial<T> {
    const result: Partial<T> = { ...obj };
    for (const key of keys) {
      delete result[key];
    }
    return result;
  }

  static only<T extends object>(obj: T, keys: Array<keyof T>): Partial<T> {
    const result: Partial<T> = {};
    for (const key of keys) {
      if (key in obj) {
        result[key] = obj[key];
      }
    }
    return result;
  }
}
