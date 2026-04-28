import { faker, type Faker } from '@faker-js/faker';
import type { ColumnValue } from '@faber-js/orm';
import type { FieldDefinition, SchemaShape } from './types';

type CreateFn<T> = (attrs: Record<string, ColumnValue>) => Promise<T>;
type FillFn<T> = (attrs: Record<string, ColumnValue>) => T;

type StateOverride<T> =
  | Partial<Record<string, ColumnValue>>
  | ((faker: Faker) => Partial<Record<keyof T, ColumnValue>>);

function fakeValue(fieldName: string, def: FieldDefinition): ColumnValue {
  if (def.hasDefault) return def.defaultValue as ColumnValue;

  switch (def.kind) {
    case 'id':
      return faker.number.int({ min: 1, max: 9999 });
    case 'string': {
      const lc = fieldName.toLowerCase();
      if (lc.includes('name')) return faker.person.fullName();
      if (lc.includes('title')) return faker.lorem.words(3);
      if (lc.includes('slug')) return faker.lorem.slug();
      if (lc.includes('phone')) return faker.phone.number();
      if (lc.includes('url') || lc.includes('website')) return faker.internet.url();
      if (lc.includes('color') || lc.includes('colour')) return faker.color.human();
      if (def.min !== undefined && def.max !== undefined) {
        return faker.lorem.words(1).slice(0, def.max);
      }
      return faker.lorem.words(2);
    }
    case 'text':
      return faker.lorem.paragraph();
    case 'email':
      return faker.internet.email();
    case 'uuid':
      return faker.string.uuid();
    case 'integer':
    case 'bigInteger':
      return faker.number.int({ min: def.min ?? 0, max: def.max ?? 10000 });
    case 'foreignId':
      return faker.number.int({ min: 1, max: 100 });
    case 'float':
    case 'decimal':
      return parseFloat(
        faker.number
          .float({ min: def.min ?? 0, max: def.max ?? 1000, fractionDigits: def.scale ?? 2 })
          .toFixed(def.scale ?? 2),
      );
    case 'boolean':
      return faker.datatype.boolean();
    case 'date':
      return faker.date.recent();
    case 'timestamp':
      return faker.date.recent();
    case 'enum':
      if (def.enumValues && def.enumValues.length > 0) {
        const idx = faker.number.int({ min: 0, max: def.enumValues.length - 1 });
        return def.enumValues[idx] ?? null;
      }
      return null;
    case 'json':
      return null;
    default:
      return null;
  }
}

function buildDefinition(shape: SchemaShape): Record<string, ColumnValue> {
  const result: Record<string, ColumnValue> = {};
  for (const [key, field] of Object.entries(shape)) {
    if (field._def.auto) continue;
    result[key] = fakeValue(key, field._def);
  }
  return result;
}

export class SchemaFactory<T extends object> {
  readonly #shape: SchemaShape;
  readonly #create: CreateFn<T>;
  readonly #fill: FillFn<T>;
  #count = 1;
  #stateOverrides: Record<string, ColumnValue> = {};

  constructor(shape: SchemaShape, create: CreateFn<T>, fill: FillFn<T>) {
    this.#shape = shape;
    this.#create = create;
    this.#fill = fill;
  }

  times(n: number): this {
    this.#count = n;
    return this;
  }

  state(overrides: StateOverride<T>): this {
    const resolved =
      typeof overrides === 'function'
        ? (overrides as (f: typeof faker) => Record<string, ColumnValue>)(faker)
        : (overrides as Record<string, ColumnValue>);
    this.#stateOverrides = { ...this.#stateOverrides, ...resolved };
    return this;
  }

  make(overrides: Record<string, ColumnValue> = {}): T[] {
    const results: T[] = [];
    for (let i = 0; i < this.#count; i++) {
      const attrs = { ...buildDefinition(this.#shape), ...this.#stateOverrides, ...overrides };
      results.push(this.#fill(attrs));
    }
    return results;
  }

  async create(overrides: Record<string, ColumnValue> = {}): Promise<T[]> {
    const results: T[] = [];
    for (let i = 0; i < this.#count; i++) {
      const attrs = { ...buildDefinition(this.#shape), ...this.#stateOverrides, ...overrides };
      results.push(await this.#create(attrs));
    }
    return results;
  }

  makeOne(overrides: Record<string, ColumnValue> = {}): T {
    const attrs = { ...buildDefinition(this.#shape), ...this.#stateOverrides, ...overrides };
    return this.#fill(attrs);
  }

  async createOne(overrides: Record<string, ColumnValue> = {}): Promise<T> {
    const attrs = { ...buildDefinition(this.#shape), ...this.#stateOverrides, ...overrides };
    return this.#create(attrs);
  }
}
