import type { ColumnValue, ModelStatics } from './types';

// Minimal interface to avoid circular dependency
interface Fillable {
  fill(attrs: Record<string, ColumnValue>): void;
}

type StaticCreate<T extends object> = ModelStatics<T> & {
  create(attrs: Record<string, ColumnValue>): Promise<T>;
};

export abstract class Factory<T extends Fillable & object> {
  abstract readonly model: StaticCreate<T>;
  abstract definition(): Record<string, ColumnValue>;

  #count = 1;
  #stateOverrides: Record<string, ColumnValue> = {};

  count(n: number): this {
    this.#count = n;
    return this;
  }

  state(overrides: Record<string, ColumnValue>): this {
    this.#stateOverrides = { ...this.#stateOverrides, ...overrides };
    return this;
  }

  async create(overrides: Record<string, ColumnValue> = {}): Promise<T[]> {
    const results: T[] = [];
    for (let i = 0; i < this.#count; i++) {
      const attrs = { ...this.definition(), ...this.#stateOverrides, ...overrides };
      const instance = await this.model.create(attrs);
      results.push(instance);
    }
    return results;
  }

  make(overrides: Record<string, ColumnValue> = {}): T[] {
    const results: T[] = [];
    for (let i = 0; i < this.#count; i++) {
      const attrs = { ...this.definition(), ...this.#stateOverrides, ...overrides };
      const instance = new this.model();
      instance.fill(attrs);
      results.push(instance);
    }
    return results;
  }
}
