import 'reflect-metadata';
import { Injectable } from '@faberjs/core';
import type {
  ColumnValue,
  ModelStatics,
  OrderDirection,
  PaginationResult,
  WhereOperator,
} from './types';
import { QueryBuilder } from './query-builder';
import { getConnection } from './connection';
import { ModelNotFoundException } from './exceptions';
import { HasMany, HasOne, BelongsTo, BelongsToMany } from './relations';

@Injectable()
export abstract class Model {
  static table = '';
  static softDeletes = false;
  static hidden: readonly string[] = [];
  static fillable: readonly string[] = [];
  static primaryKey = 'id';

  #attributes: Record<string, ColumnValue> = {};
  #relations: Record<string, unknown> = {};
  exists = false;

  fill(attrs: Record<string, ColumnValue>): this {
    this.#attributes = { ...this.#attributes, ...attrs };
    return this;
  }

  getAttribute(key: string): ColumnValue | undefined {
    return this.#attributes[key];
  }

  setAttribute(key: string, value: ColumnValue): this {
    this.#attributes[key] = value;
    return this;
  }

  getRelation<T>(key: string): T | undefined {
    return this.#relations[key] as T | undefined;
  }

  setRelation(key: string, value: unknown): this {
    this.#relations[key] = value;
    return this;
  }

  toObject(): Record<string, ColumnValue> {
    const hidden = (this.constructor as typeof Model).hidden;
    const result: Record<string, ColumnValue> = {};
    for (const [key, value] of Object.entries(this.#attributes)) {
      if (value !== undefined && !hidden.includes(key)) {
        result[key] = value;
      }
    }
    return result;
  }

  // ── Instance CRUD ──────────────────────────────────────────────

  async save(): Promise<this> {
    const ctor = this.constructor as typeof Model;
    const db = getConnection();
    const attrs = { ...this.#attributes };

    if (this.exists) {
      const pk = attrs[ctor.primaryKey];
      await db(ctor.table).where(ctor.primaryKey, pk).update(attrs);
    } else {
      const result = await db(ctor.table).insert(attrs);
      const id = Array.isArray(result) ? result[0] : result;
      if (id !== undefined) this.#attributes[ctor.primaryKey] = id as ColumnValue;
      this.exists = true;
    }
    return this;
  }

  async update(attrs: Record<string, ColumnValue>): Promise<this> {
    this.fill(attrs);
    return this.save();
  }

  async delete(): Promise<void> {
    const ctor = this.constructor as typeof Model;
    const pk = this.#attributes[ctor.primaryKey];
    const db = getConnection();
    if (ctor.softDeletes) {
      const now = new Date().toISOString();
      await db(ctor.table).where(ctor.primaryKey, pk).update({ deleted_at: now });
      this.#attributes['deleted_at'] = now;
    } else {
      await db(ctor.table).where(ctor.primaryKey, pk).delete();
      this.exists = false;
    }
  }

  async restore(): Promise<void> {
    const ctor = this.constructor as typeof Model;
    if (!ctor.softDeletes) return;
    const pk = this.#attributes[ctor.primaryKey];
    await getConnection()(ctor.table).where(ctor.primaryKey, pk).update({ deleted_at: null });
    this.#attributes['deleted_at'] = null;
  }

  // ── Relations ──────────────────────────────────────────────────

  protected hasMany<TRelated extends Model>(
    related: ModelStatics<TRelated>,
    foreignKey?: string,
    localKey = 'id',
  ): HasMany<this, TRelated> {
    const fk = foreignKey ?? `${(this.constructor as typeof Model).table.replace(/s$/, '')}_id`;
    return new HasMany(this, related, fk, localKey);
  }

  protected hasOne<TRelated extends Model>(
    related: ModelStatics<TRelated>,
    foreignKey?: string,
    localKey = 'id',
  ): HasOne<this, TRelated> {
    const fk = foreignKey ?? `${(this.constructor as typeof Model).table.replace(/s$/, '')}_id`;
    return new HasOne(this, related, fk, localKey);
  }

  protected belongsTo<TRelated extends Model>(
    related: ModelStatics<TRelated>,
    foreignKey?: string,
    ownerKey = 'id',
  ): BelongsTo<this, TRelated> {
    const fk = foreignKey ?? `${related.table.replace(/s$/, '')}_id`;
    return new BelongsTo(this, related, fk, ownerKey);
  }

  protected belongsToMany<TRelated extends Model>(
    related: ModelStatics<TRelated>,
    pivotTable: string,
    foreignPivotKey?: string,
    relatedPivotKey?: string,
  ): BelongsToMany<this, TRelated> {
    const fpk =
      foreignPivotKey ?? `${(this.constructor as typeof Model).table.replace(/s$/, '')}_id`;
    const rpk = relatedPivotKey ?? `${related.table.replace(/s$/, '')}_id`;
    return new BelongsToMany(this, related, pivotTable, fpk, rpk);
  }

  // ── Static methods ─────────────────────────────────────────────

  static async find<T extends Model>(this: ModelStatics<T>, id: ColumnValue): Promise<T | null> {
    const ctor = this as unknown as typeof Model;
    const db = getConnection();
    const rows = await db(ctor.table).where(ctor.primaryKey, id).limit(1).select('*');
    const arr = rows as Array<Record<string, ColumnValue>>;
    const first = arr[0];
    if (!first) return null;
    const instance = new this();
    (instance as unknown as Model).fill(first);
    (instance as unknown as Model).exists = true;
    return instance;
  }

  static async findOrFail<T extends Model>(this: ModelStatics<T>, id: ColumnValue): Promise<T> {
    const ctor = this as unknown as typeof Model;
    const result = (await ctor.find.call(this, id)) as T | null;
    if (!result) {
      throw new ModelNotFoundException(`No record with id=${String(id)} found in '${ctor.table}'`);
    }
    return result;
  }

  static async all<T extends Model>(this: ModelStatics<T>): Promise<T[]> {
    return new QueryBuilder<T>(this).get();
  }

  static async create<T extends Model>(
    this: ModelStatics<T>,
    attrs: Record<string, ColumnValue>,
  ): Promise<T> {
    const instance = new this();
    (instance as unknown as Model).fill(attrs);
    await (instance as unknown as Model).save();
    return instance;
  }

  static where<T extends Model>(
    this: ModelStatics<T>,
    column: string,
    operatorOrValue: WhereOperator | ColumnValue,
    value?: ColumnValue,
  ): QueryBuilder<T> {
    const qb = new QueryBuilder<T>(this);
    if (value === undefined) {
      return qb.where(column, operatorOrValue as ColumnValue);
    }
    return qb.where(column, operatorOrValue as WhereOperator, value);
  }

  static orWhere<T extends Model>(
    this: ModelStatics<T>,
    column: string,
    operatorOrValue: WhereOperator | ColumnValue,
    value?: ColumnValue,
  ): QueryBuilder<T> {
    const qb = new QueryBuilder<T>(this);
    if (value === undefined) {
      return qb.orWhere(column, operatorOrValue as ColumnValue);
    }
    return qb.orWhere(column, operatorOrValue as WhereOperator, value);
  }

  static orderBy<T extends Model>(
    this: ModelStatics<T>,
    column: string,
    direction: OrderDirection = 'asc',
  ): QueryBuilder<T> {
    return new QueryBuilder<T>(this).orderBy(column, direction);
  }

  static withTrashed<T extends Model>(this: ModelStatics<T>): QueryBuilder<T> {
    return new QueryBuilder<T>(this).withTrashed();
  }

  static with<T extends Model>(this: ModelStatics<T>, ...relations: string[]): QueryBuilder<T> {
    return new QueryBuilder<T>(this).with(...relations);
  }

  static async count<T extends Model>(this: ModelStatics<T>): Promise<number> {
    return new QueryBuilder<T>(this).count();
  }

  static async avg<T extends Model>(this: ModelStatics<T>, column: string): Promise<number> {
    return new QueryBuilder<T>(this).avg(column);
  }

  static async paginate<T extends Model>(
    this: ModelStatics<T>,
    perPage = 15,
    page = 1,
  ): Promise<PaginationResult<T>> {
    return new QueryBuilder<T>(this).paginate(perPage, page);
  }
}
