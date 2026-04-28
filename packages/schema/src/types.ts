import type { ColumnValue, PaginationResult } from '@faber-js/orm';
import type { ValidationRules } from '@faber-js/validation';
import type { FieldBuilder } from './field-builder';
import type { SchemaModel } from './schema-model';
import type { SchemaFactory } from './schema-factory';

export type FieldKind =
  | 'id'
  | 'string'
  | 'text'
  | 'integer'
  | 'bigInteger'
  | 'float'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'timestamp'
  | 'json'
  | 'uuid'
  | 'email'
  | 'enum'
  | 'foreignId';

export interface FieldDefinition {
  readonly kind: FieldKind;
  readonly nullable: boolean;
  readonly hasDefault: boolean;
  readonly defaultValue?: unknown;
  readonly hidden: boolean;
  readonly auto: boolean;
  readonly unique: boolean;
  readonly index: boolean;
  readonly unsigned: boolean;
  readonly min?: number;
  readonly max?: number;
  readonly length?: number;
  readonly precision?: number;
  readonly scale?: number;
  readonly enumValues?: readonly string[];
  readonly foreignTable?: string;
}

export type SchemaShape = Record<string, FieldBuilder<unknown, boolean>>;

export type InferFieldType<F> =
  F extends FieldBuilder<infer T, infer N> ? (N extends true ? T | null : T) : never;

export type InferSchemaType<S extends SchemaShape> = {
  [K in keyof S]: InferFieldType<S[K]>;
};

export interface OpenApiProperty {
  type?: string;
  format?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  enum?: string[];
  readOnly?: boolean;
  writeOnly?: boolean;
  nullable?: boolean;
}

export interface OpenApiSchema {
  readonly type: 'object';
  readonly properties: Record<string, OpenApiProperty>;
  readonly required: string[];
}

// A minimal typed query builder interface over the ORM QueryBuilder
export interface SchemaQueryBuilder<T> {
  get(): Promise<T[]>;
  first(): Promise<T | null>;
  firstOrFail(): Promise<T>;
  count(): Promise<number>;
  avg(column: string): Promise<number>;
  where(
    column: string,
    operatorOrValue: string | ColumnValue,
    value?: ColumnValue,
  ): SchemaQueryBuilder<T>;
  orWhere(
    column: string,
    operatorOrValue: string | ColumnValue,
    value?: ColumnValue,
  ): SchemaQueryBuilder<T>;
  orderBy(column: string, direction?: 'asc' | 'desc'): SchemaQueryBuilder<T>;
  limit(n: number): SchemaQueryBuilder<T>;
  offset(n: number): SchemaQueryBuilder<T>;
  with(...relations: string[]): SchemaQueryBuilder<T>;
  withTrashed(): SchemaQueryBuilder<T>;
  select(...columns: string[]): SchemaQueryBuilder<T>;
  update(attrs: Record<string, ColumnValue>): Promise<number>;
  delete(): Promise<void>;
  paginate(perPage?: number, page?: number, baseUrl?: string): Promise<PaginationResult<T>>;
}

// The constructor type returned by schema()
export interface SchemaModelCtor<T> {
  new (): T & SchemaModel;
  table: string;
  softDeletes: boolean;
  hidden: readonly string[];
  fillable: readonly string[];
  primaryKey: string;
  _schema: SchemaShape;

  find(id: ColumnValue): Promise<(T & SchemaModel) | null>;
  findOrFail(id: ColumnValue): Promise<T & SchemaModel>;
  all(): Promise<Array<T & SchemaModel>>;
  create(attrs: Record<string, ColumnValue>): Promise<T & SchemaModel>;
  firstOrCreate(
    where: Record<string, ColumnValue>,
    attrs?: Record<string, ColumnValue>,
  ): Promise<T & SchemaModel>;
  updateOrCreate(
    where: Record<string, ColumnValue>,
    attrs: Record<string, ColumnValue>,
  ): Promise<T & SchemaModel>;
  upsert(values: Array<Record<string, ColumnValue>>, uniqueBy: string | string[]): Promise<void>;
  where(
    column: string,
    operatorOrValue: string | ColumnValue,
    value?: ColumnValue,
  ): SchemaQueryBuilder<T & SchemaModel>;
  orWhere(
    column: string,
    operatorOrValue: string | ColumnValue,
    value?: ColumnValue,
  ): SchemaQueryBuilder<T & SchemaModel>;
  orderBy(column: string, direction?: 'asc' | 'desc'): SchemaQueryBuilder<T & SchemaModel>;
  withTrashed(): SchemaQueryBuilder<T & SchemaModel>;
  with(...relations: string[]): SchemaQueryBuilder<T & SchemaModel>;
  count(): Promise<number>;

  factory(): SchemaFactory<T & SchemaModel>;
  rules(fields?: string[], overrides?: ValidationRules): ValidationRules;
  openapi(): OpenApiSchema;
}

export type { ValidationRules };
