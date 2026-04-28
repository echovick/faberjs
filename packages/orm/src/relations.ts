import type { ColumnValue, ModelStatics } from './types';
import { getConnection } from './connection';

// Minimal interface to avoid circular dependency with model.ts
interface ModelLike {
  fill(attrs: Record<string, ColumnValue>): void;
  exists: boolean;
  getAttribute(key: string): ColumnValue | undefined;
  setRelation(key: string, value: unknown): void;
}

function hydrateRow<T extends ModelLike>(
  ctor: ModelStatics<T>,
  row: Record<string, ColumnValue>,
): T {
  const instance = new ctor();
  instance.fill(row);
  instance.exists = true;
  return instance;
}

export class HasMany<TParent extends ModelLike, TRelated extends ModelLike> {
  readonly #parent: TParent;
  readonly #relatedCtor: ModelStatics<TRelated>;
  readonly #foreignKey: string;
  readonly #localKey: string;

  constructor(
    parent: TParent,
    relatedCtor: ModelStatics<TRelated>,
    foreignKey: string,
    localKey = 'id',
  ) {
    this.#parent = parent;
    this.#relatedCtor = relatedCtor;
    this.#foreignKey = foreignKey;
    this.#localKey = localKey;
  }

  async get(): Promise<TRelated[]> {
    const db = getConnection();
    const localValue = this.#parent.getAttribute(this.#localKey);
    const rows = await db(this.#relatedCtor.table).where(this.#foreignKey, localValue).select('*');
    return (rows as Array<Record<string, ColumnValue>>).map((row) =>
      hydrateRow(this.#relatedCtor, row),
    );
  }

  async load(parents: TParent[]): Promise<void> {
    if (parents.length === 0) return;
    const localValues = parents.map((p) => p.getAttribute(this.#localKey));
    const db = getConnection();
    const rows: Array<Record<string, ColumnValue>> = await db(this.#relatedCtor.table)
      .whereIn(this.#foreignKey, localValues as ColumnValue[])
      .select('*');

    const grouped = new Map<ColumnValue, TRelated[]>();
    for (const row of rows) {
      const key = row[this.#foreignKey];
      if (key === undefined) continue;
      const list = grouped.get(key) ?? [];
      list.push(hydrateRow(this.#relatedCtor, row));
      grouped.set(key, list);
    }

    for (const parent of parents) {
      const key = parent.getAttribute(this.#localKey);
      if (key === undefined) continue;
      parent.setRelation(this.#relatedCtor.table, grouped.get(key) ?? []);
    }
  }
}

export class HasOne<TParent extends ModelLike, TRelated extends ModelLike> {
  readonly #parent: TParent;
  readonly #relatedCtor: ModelStatics<TRelated>;
  readonly #foreignKey: string;
  readonly #localKey: string;

  constructor(
    parent: TParent,
    relatedCtor: ModelStatics<TRelated>,
    foreignKey: string,
    localKey = 'id',
  ) {
    this.#parent = parent;
    this.#relatedCtor = relatedCtor;
    this.#foreignKey = foreignKey;
    this.#localKey = localKey;
  }

  async get(): Promise<TRelated | null> {
    const db = getConnection();
    const localValue = this.#parent.getAttribute(this.#localKey);
    const rows = await db(this.#relatedCtor.table)
      .where(this.#foreignKey, localValue)
      .limit(1)
      .select('*');
    const arr = rows as Array<Record<string, ColumnValue>>;
    if (arr.length === 0) return null;
    const first = arr[0];
    if (!first) return null;
    return hydrateRow(this.#relatedCtor, first);
  }

  async load(parents: TParent[]): Promise<void> {
    if (parents.length === 0) return;
    const localValues = parents.map((p) => p.getAttribute(this.#localKey));
    const db = getConnection();
    const rows: Array<Record<string, ColumnValue>> = await db(this.#relatedCtor.table)
      .whereIn(this.#foreignKey, localValues as ColumnValue[])
      .select('*');

    const map = new Map<ColumnValue, TRelated>();
    for (const row of rows) {
      const key = row[this.#foreignKey];
      if (key === undefined) continue;
      map.set(key, hydrateRow(this.#relatedCtor, row));
    }

    for (const parent of parents) {
      const key = parent.getAttribute(this.#localKey);
      if (key === undefined) continue;
      parent.setRelation(this.#relatedCtor.table, map.get(key) ?? null);
    }
  }
}

export class BelongsTo<TParent extends ModelLike, TRelated extends ModelLike> {
  readonly #parent: TParent;
  readonly #relatedCtor: ModelStatics<TRelated>;
  readonly #foreignKey: string;
  readonly #ownerKey: string;

  constructor(
    parent: TParent,
    relatedCtor: ModelStatics<TRelated>,
    foreignKey: string,
    ownerKey = 'id',
  ) {
    this.#parent = parent;
    this.#relatedCtor = relatedCtor;
    this.#foreignKey = foreignKey;
    this.#ownerKey = ownerKey;
  }

  async get(): Promise<TRelated | null> {
    const db = getConnection();
    const foreignValue = this.#parent.getAttribute(this.#foreignKey);
    if (foreignValue === null || foreignValue === undefined) return null;
    const rows = await db(this.#relatedCtor.table)
      .where(this.#ownerKey, foreignValue)
      .limit(1)
      .select('*');
    const arr = rows as Array<Record<string, ColumnValue>>;
    if (arr.length === 0) return null;
    const first = arr[0];
    if (!first) return null;
    return hydrateRow(this.#relatedCtor, first);
  }

  async load(parents: TParent[]): Promise<void> {
    if (parents.length === 0) return;
    const foreignValues = parents
      .map((p) => p.getAttribute(this.#foreignKey))
      .filter((v): v is ColumnValue => v !== null && v !== undefined);
    const db = getConnection();
    const rows: Array<Record<string, ColumnValue>> = await db(this.#relatedCtor.table)
      .whereIn(this.#ownerKey, foreignValues)
      .select('*');

    const map = new Map<ColumnValue, TRelated>();
    for (const row of rows) {
      const key = row[this.#ownerKey];
      if (key === undefined) continue;
      map.set(key, hydrateRow(this.#relatedCtor, row));
    }

    for (const parent of parents) {
      const key = parent.getAttribute(this.#foreignKey);
      const related = key !== null && key !== undefined ? (map.get(key) ?? null) : null;
      parent.setRelation(this.#relatedCtor.table, related);
    }
  }
}

export class BelongsToMany<TParent extends ModelLike, TRelated extends ModelLike> {
  readonly #parent: TParent;
  readonly #relatedCtor: ModelStatics<TRelated>;
  readonly #pivotTable: string;
  readonly #foreignPivotKey: string;
  readonly #relatedPivotKey: string;

  constructor(
    parent: TParent,
    relatedCtor: ModelStatics<TRelated>,
    pivotTable: string,
    foreignPivotKey: string,
    relatedPivotKey: string,
  ) {
    this.#parent = parent;
    this.#relatedCtor = relatedCtor;
    this.#pivotTable = pivotTable;
    this.#foreignPivotKey = foreignPivotKey;
    this.#relatedPivotKey = relatedPivotKey;
  }

  async get(): Promise<TRelated[]> {
    const db = getConnection();
    const parentId = this.#parent.getAttribute('id');
    const rows = await db(this.#relatedCtor.table)
      .join(
        this.#pivotTable,
        `${this.#relatedCtor.table}.id`,
        `${this.#pivotTable}.${this.#relatedPivotKey}`,
      )
      .where(`${this.#pivotTable}.${this.#foreignPivotKey}`, parentId)
      .select(`${this.#relatedCtor.table}.*`);
    return (rows as Array<Record<string, ColumnValue>>).map((row) =>
      hydrateRow(this.#relatedCtor, row),
    );
  }

  async attach(ids: number | number[], pivotData: Record<string, ColumnValue> = {}): Promise<void> {
    const db = getConnection();
    const parentId = this.#parent.getAttribute('id') as number;
    const idArray = Array.isArray(ids) ? ids : [ids];
    await db(this.#pivotTable).insert(
      idArray.map((id) => ({
        [this.#foreignPivotKey]: parentId,
        [this.#relatedPivotKey]: id,
        ...pivotData,
      })),
    );
  }

  async detach(ids?: number | number[]): Promise<void> {
    const db = getConnection();
    const parentId = this.#parent.getAttribute('id') as number;
    const query = db(this.#pivotTable).where(this.#foreignPivotKey, parentId);
    if (ids !== undefined) {
      const idArray = Array.isArray(ids) ? ids : [ids];
      void query.whereIn(this.#relatedPivotKey, idArray);
    }
    await query.delete();
  }

  async sync(ids: number[], detaching = true): Promise<void> {
    const db = getConnection();
    const parentId = this.#parent.getAttribute('id') as number;
    const currentRows: Array<Record<string, ColumnValue>> = await db(this.#pivotTable)
      .where(this.#foreignPivotKey, parentId)
      .select(this.#relatedPivotKey);
    const currentIds = currentRows.map((r) => Number(r[this.#relatedPivotKey]));
    const toAttach = ids.filter((id) => !currentIds.includes(id));
    const toDetach = detaching ? currentIds.filter((id) => !ids.includes(id)) : [];
    if (toDetach.length > 0) {
      await db(this.#pivotTable)
        .where(this.#foreignPivotKey, parentId)
        .whereIn(this.#relatedPivotKey, toDetach)
        .delete();
    }
    if (toAttach.length > 0) {
      await db(this.#pivotTable).insert(
        toAttach.map((id) => ({
          [this.#foreignPivotKey]: parentId,
          [this.#relatedPivotKey]: id,
        })),
      );
    }
  }

  async load(parents: TParent[]): Promise<void> {
    if (parents.length === 0) return;
    const parentIds = parents
      .map((p) => p.getAttribute('id'))
      .filter((v): v is ColumnValue => v !== null && v !== undefined);
    const db = getConnection();
    const pivotFkAlias = '__pivot_fk';
    const rows: Array<Record<string, ColumnValue>> = await db(this.#relatedCtor.table)
      .join(
        this.#pivotTable,
        `${this.#relatedCtor.table}.id`,
        `${this.#pivotTable}.${this.#relatedPivotKey}`,
      )
      .whereIn(`${this.#pivotTable}.${this.#foreignPivotKey}`, parentIds)
      .select(
        `${this.#relatedCtor.table}.*`,
        `${this.#pivotTable}.${this.#foreignPivotKey} as ${pivotFkAlias}`,
      );

    const grouped = new Map<ColumnValue, TRelated[]>();
    for (const row of rows) {
      const key = row[pivotFkAlias];
      if (key === undefined) continue;
      const list = grouped.get(key) ?? [];
      const { [pivotFkAlias]: _ignored, ...attrs } = row;
      void _ignored;
      list.push(hydrateRow(this.#relatedCtor, attrs as Record<string, ColumnValue>));
      grouped.set(key, list);
    }

    for (const parent of parents) {
      const key = parent.getAttribute('id');
      if (key === undefined) continue;
      parent.setRelation(this.#relatedCtor.table, grouped.get(key) ?? []);
    }
  }
}
