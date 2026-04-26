import type {
  ColumnValue,
  ModelStatics,
  OrderDirection,
  PaginationResult,
  WhereOperator,
} from './types';
import { getConnection } from './connection';
import { ModelNotFoundException } from './exceptions';

// Forward-reference type to avoid circular dependency
interface ModelLike {
  fill(attrs: Record<string, ColumnValue>): void;
  exists: boolean;
  setRelation(key: string, value: unknown): void;
}

interface EagerLoadable {
  load(models: ModelLike[]): Promise<void>;
}

type RelationFactory = () => EagerLoadable;

export class QueryBuilder<T extends ModelLike> {
  readonly #ModelCtor: ModelStatics<T>;
  readonly #tableName: string;
  #wheres: Array<{
    type: 'where' | 'orWhere';
    column: string;
    operator: WhereOperator;
    value: ColumnValue;
  }> = [];
  #orderBys: Array<{ column: string; direction: OrderDirection }> = [];
  #limitValue: number | null = null;
  #offsetValue: number | null = null;
  #includeTrashed = false;
  #eagerLoads: string[] = [];

  constructor(ctor: ModelStatics<T>) {
    this.#ModelCtor = ctor;
    this.#tableName = ctor.table;
  }

  where(column: string, operatorOrValue: WhereOperator | ColumnValue, value?: ColumnValue): this {
    const [op, val] =
      value === undefined
        ? (['=' as WhereOperator, operatorOrValue as ColumnValue] as const)
        : ([operatorOrValue as WhereOperator, value] as const);
    this.#wheres.push({ type: 'where', column, operator: op, value: val });
    return this;
  }

  orWhere(column: string, operatorOrValue: WhereOperator | ColumnValue, value?: ColumnValue): this {
    const [op, val] =
      value === undefined
        ? (['=' as WhereOperator, operatorOrValue as ColumnValue] as const)
        : ([operatorOrValue as WhereOperator, value] as const);
    this.#wheres.push({ type: 'orWhere', column, operator: op, value: val });
    return this;
  }

  orderBy(column: string, direction: OrderDirection = 'asc'): this {
    this.#orderBys.push({ column, direction });
    return this;
  }

  limit(n: number): this {
    this.#limitValue = n;
    return this;
  }

  offset(n: number): this {
    this.#offsetValue = n;
    return this;
  }

  withTrashed(): this {
    this.#includeTrashed = true;
    return this;
  }

  with(...relations: string[]): this {
    this.#eagerLoads.push(...relations);
    return this;
  }

  async get(): Promise<T[]> {
    const rows = await this.#buildQuery().select('*');
    const models = (rows as Array<Record<string, ColumnValue>>).map((row) => this.#hydrate(row));
    if (this.#eagerLoads.length > 0) {
      await this.#loadRelations(models as unknown as ModelLike[]);
    }
    return models;
  }

  async first(): Promise<T | null> {
    const rows = await this.#buildQuery().limit(1).select('*');
    const arr = rows as Array<Record<string, ColumnValue>>;
    const first = arr[0];
    if (!first) return null;
    return this.#hydrate(first);
  }

  async firstOrFail(): Promise<T> {
    const result = await this.first();
    if (!result) throw new ModelNotFoundException(`No record found in '${this.#tableName}'`);
    return result;
  }

  async count(): Promise<number> {
    const result = await this.#buildQuery().count('* as count');
    const row = (result as Array<Record<string, unknown>>)[0];
    if (!row) return 0;
    return Number(row['count']);
  }

  async avg(column: string): Promise<number> {
    const result = await this.#buildQuery().avg(`${column} as avg`);
    const row = (result as Array<Record<string, unknown>>)[0];
    if (!row) return 0;
    return Number(row['avg']);
  }

  async update(attrs: Record<string, ColumnValue>): Promise<void> {
    await this.#buildQuery().update(attrs);
  }

  async delete(): Promise<void> {
    if (this.#ModelCtor.softDeletes && !this.#includeTrashed) {
      await this.#buildQuery().update({ deleted_at: new Date().toISOString() });
    } else {
      await this.#buildQuery().delete();
    }
  }

  async paginate(perPage = 15, page = 1): Promise<PaginationResult<T>> {
    const total = await this.count();
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const rows = await this.#buildQuery()
      .limit(perPage)
      .offset((page - 1) * perPage)
      .select('*');
    const data = (rows as Array<Record<string, ColumnValue>>).map((row) => this.#hydrate(row));
    return {
      data,
      meta: { current_page: page, last_page: lastPage, per_page: perPage, total },
      links: {
        first: null,
        last: null,
        prev: page > 1 ? null : null,
        next: page < lastPage ? null : null,
      },
    };
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  #buildQuery() {
    const db = getConnection();
    let q = db(this.#tableName);

    if (this.#ModelCtor.softDeletes && !this.#includeTrashed) {
      q = q.whereNull('deleted_at');
    }

    for (const w of this.#wheres) {
      if (w.type === 'where') {
        q = q.where(w.column, w.operator, w.value);
      } else {
        q = q.orWhere(w.column, w.operator, w.value);
      }
    }

    for (const o of this.#orderBys) {
      q = q.orderBy(o.column, o.direction);
    }

    if (this.#limitValue !== null) q = q.limit(this.#limitValue);
    if (this.#offsetValue !== null) q = q.offset(this.#offsetValue);

    return q;
  }

  #hydrate(row: Record<string, ColumnValue>): T {
    const instance = new this.#ModelCtor();
    instance.fill(row);
    instance.exists = true;
    return instance;
  }

  async #loadRelations(models: ModelLike[]): Promise<void> {
    if (models.length === 0) return;
    const sample = models[0];
    if (!sample) return;
    for (const relation of this.#eagerLoads) {
      const candidate = (sample as unknown as Record<string, unknown>)[relation];
      if (typeof candidate !== 'function') continue;
      const relFactory = candidate as RelationFactory;
      const relInstance = relFactory.call(sample);
      await relInstance.load(models);
    }
  }
}
