import type { Knex } from 'knex';
import type { ColumnValue } from './types';
import { getConnection } from './connection';

export class ColumnDefinition {
  readonly #col: Knex.ColumnBuilder;

  constructor(col: Knex.ColumnBuilder) {
    this.#col = col;
  }

  nullable(): this {
    this.#col.nullable();
    return this;
  }

  notNullable(): this {
    this.#col.notNullable();
    return this;
  }

  unique(): this {
    this.#col.unique();
    return this;
  }

  defaultTo(value: ColumnValue): this {
    this.#col.defaultTo(value);
    return this;
  }

  unsigned(): this {
    this.#col.unsigned();
    return this;
  }

  primary(): this {
    this.#col.primary();
    return this;
  }
}

export class ForeignKeyReferencingBuilder {
  #ref: Knex.ReferencingColumnBuilder;

  constructor(ref: Knex.ReferencingColumnBuilder) {
    this.#ref = ref;
  }

  on(table: string): this {
    this.#ref = this.#ref.inTable(table);
    return this;
  }

  onDelete(action: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION'): this {
    this.#ref = this.#ref.onDelete(action);
    return this;
  }

  onUpdate(action: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION'): this {
    this.#ref = this.#ref.onUpdate(action);
    return this;
  }
}

export class ForeignKeyBuilder {
  readonly #fkBuilder: Knex.ForeignConstraintBuilder;

  constructor(fkBuilder: Knex.ForeignConstraintBuilder) {
    this.#fkBuilder = fkBuilder;
  }

  references(column: string): ForeignKeyReferencingBuilder {
    return new ForeignKeyReferencingBuilder(this.#fkBuilder.references(column));
  }
}

export class Blueprint {
  readonly #table: Knex.CreateTableBuilder;

  constructor(table: Knex.CreateTableBuilder) {
    this.#table = table;
  }

  id(): ColumnDefinition {
    return new ColumnDefinition(this.#table.increments('id').primary());
  }

  string(column: string, length = 255): ColumnDefinition {
    return new ColumnDefinition(this.#table.string(column, length));
  }

  text(column: string): ColumnDefinition {
    return new ColumnDefinition(this.#table.text(column));
  }

  integer(column: string): ColumnDefinition {
    return new ColumnDefinition(this.#table.integer(column));
  }

  bigInteger(column: string): ColumnDefinition {
    return new ColumnDefinition(this.#table.bigInteger(column));
  }

  boolean(column: string): ColumnDefinition {
    return new ColumnDefinition(this.#table.boolean(column));
  }

  decimal(column: string, precision = 8, scale = 2): ColumnDefinition {
    return new ColumnDefinition(this.#table.decimal(column, precision, scale));
  }

  json(column: string): ColumnDefinition {
    return new ColumnDefinition(this.#table.json(column));
  }

  enum(column: string, values: string[]): ColumnDefinition {
    return new ColumnDefinition(this.#table.enu(column, values));
  }

  date(column: string): ColumnDefinition {
    return new ColumnDefinition(this.#table.date(column));
  }

  float(column: string, precision = 8, scale = 2): ColumnDefinition {
    return new ColumnDefinition(this.#table.float(column, precision, scale));
  }

  uuid(column: string): ColumnDefinition {
    return new ColumnDefinition(this.#table.uuid(column));
  }

  timestamp(column: string): ColumnDefinition {
    return new ColumnDefinition(this.#table.timestamp(column, { useTz: false }).nullable());
  }

  timestamps(): void {
    const now = getConnection().fn.now();
    this.#table.timestamp('created_at', { useTz: false }).notNullable().defaultTo(now);
    this.#table.timestamp('updated_at', { useTz: false }).notNullable().defaultTo(now);
  }

  softDeletes(): void {
    this.#table.timestamp('deleted_at', { useTz: false }).nullable();
  }

  uniqueIndex(columns: string[]): this {
    this.#table.unique(columns);
    return this;
  }

  index(columns: string[]): this {
    this.#table.index(columns);
    return this;
  }

  foreign(column: string): ForeignKeyBuilder {
    return new ForeignKeyBuilder(this.#table.foreign(column));
  }

  dropColumn(column: string): this {
    this.#table.dropColumn(column);
    return this;
  }

  renameColumn(from: string, to: string): this {
    this.#table.renameColumn(from, to);
    return this;
  }
}
