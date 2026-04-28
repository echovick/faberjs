export type ColumnValue = string | number | boolean | null | Date;
export type WhereOperator = '=' | '!=' | '<' | '<=' | '>' | '>=' | 'like' | 'not like';
export type OrderDirection = 'asc' | 'desc';

export interface ConnectionConfig {
  readonly client: 'sqlite3' | 'pg' | 'mysql2' | 'better-sqlite3' | 'sqlite-wasm';
  readonly connection: string | SqliteConnectionConfig | PgConnectionConfig;
}

export interface SqliteConnectionConfig {
  readonly filename: string;
}

export interface PgConnectionConfig {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: string;
}

export interface PaginationMeta {
  readonly current_page: number;
  readonly last_page: number;
  readonly per_page: number;
  readonly total: number;
}

export interface PaginationLinks {
  readonly first: string | null;
  readonly last: string | null;
  readonly prev: string | null;
  readonly next: string | null;
}

export interface PaginationResult<T> {
  readonly data: T[];
  readonly meta: PaginationMeta;
  readonly links: PaginationLinks;
}

export interface MigrationRecord {
  readonly id: number;
  readonly migration: string;
  readonly batch: number;
}

export interface ModelStatics<T extends object> {
  new (): T;
  table: string;
  softDeletes: boolean;
  hidden: readonly string[];
  fillable: readonly string[];
  primaryKey: string;
}

export type ModelAttributes = Record<string, ColumnValue>;
