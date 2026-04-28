import 'reflect-metadata';
import type { ColumnValue, Model } from '@faber-js/orm';
import type { InferSchemaType, SchemaModelCtor, SchemaShape } from './types';
import { SchemaModel } from './schema-model';
import { SchemaFactory } from './schema-factory';

export function schema<S extends SchemaShape>(
  table: string,
  shape: S,
): SchemaModelCtor<InferSchemaType<S>> {
  const hidden: string[] = [];
  const fillable: string[] = [];

  for (const [key, field] of Object.entries(shape)) {
    if (field._def.auto) continue;
    fillable.push(key);
    if (field._def.hidden) hidden.push(key);
  }

  class SchemaGenerated extends SchemaModel {
    static override table = table;
    static override hidden = hidden as readonly string[];
    static override fillable = fillable as readonly string[];
    static override _schema = shape;

    static factory<T extends SchemaGenerated>(this: new () => T): SchemaFactory<T> {
      const createFn = (attrs: Record<string, ColumnValue>): Promise<T> =>
        (SchemaGenerated as unknown as typeof Model).create.call(
          SchemaGenerated,
          attrs,
        ) as Promise<T>;

      const fillFn = (attrs: Record<string, ColumnValue>): T => {
        const instance = new SchemaGenerated() as T;
        (instance as unknown as Model).fill(attrs);
        return instance;
      };

      return new SchemaFactory<T>(shape, createFn, fillFn);
    }
  }

  // Add typed property accessors for each field
  for (const key of Object.keys(shape)) {
    Object.defineProperty(SchemaGenerated.prototype, key, {
      get(this: Model) {
        return this.getAttribute(key);
      },
      set(this: Model, value: ColumnValue) {
        this.setAttribute(key, value);
      },
      enumerable: true,
      configurable: true,
    });
  }

  return SchemaGenerated as unknown as SchemaModelCtor<InferSchemaType<S>>;
}
