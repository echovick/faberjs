import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// ── Minimal sql.js type surface ────────────────────────────────────────────────

interface SqlJsStatement {
  bind(params: unknown[]): void;
  step(): boolean;
  getAsObject(): Record<string, unknown>;
  free(): void;
}

interface SqlJsDatabase {
  run(sql: string, params?: unknown[]): void;
  prepare(sql: string): SqlJsStatement;
  exec(sql: string): Array<{ columns: string[]; values: unknown[][] }>;
  export(): Uint8Array;
  getRowsModified(): number;
  close(): void;
}

interface SqlJsModule {
  Database: new (data?: Buffer | null) => SqlJsDatabase;
}

// ── better-sqlite3-compatible shim ─────────────────────────────────────────────

export class SqliteWasmDatabase {
  readonly #db: SqlJsDatabase;
  readonly #filename: string;

  constructor(db: SqlJsDatabase, filename: string) {
    this.#db = db;
    this.#filename = filename;
  }

  prepare(sql: string): SqliteWasmStatement {
    return new SqliteWasmStatement(this.#db, sql, () => {
      this.#persist();
    });
  }

  exec(sql: string): void {
    this.#db.exec(sql);
    this.#persist();
  }

  pragma(str: string): void {
    this.#db.run(`PRAGMA ${str}`);
  }

  close(): void {
    this.#persist();
    this.#db.close();
  }

  #persist(): void {
    if (this.#filename === ':memory:') return;
    try {
      const data = this.#db.export();
      const dir = dirname(this.#filename);
      if (dir && dir !== '.') mkdirSync(dir, { recursive: true });
      writeFileSync(this.#filename, Buffer.from(data));
    } catch {
      // best-effort — don't crash on transient FS errors during dev
    }
  }
}

class SqliteWasmStatement {
  readonly #db: SqlJsDatabase;
  readonly #sql: string;
  readonly #persist: () => void;

  constructor(db: SqlJsDatabase, sql: string, persist: () => void) {
    this.#db = db;
    this.#sql = sql;
    this.#persist = persist;
  }

  run(bindings?: unknown[]): { changes: number; lastInsertRowid: number } {
    const stmt = this.#db.prepare(this.#sql);
    if (bindings && bindings.length > 0) stmt.bind(bindings);
    stmt.step();
    stmt.free();
    this.#persist();

    const changes = this.#db.getRowsModified();
    const lastIdResult = this.#db.exec('SELECT last_insert_rowid() AS id');
    const lastInsertRowid = Number(lastIdResult[0]?.values[0]?.[0] ?? 0);

    return { changes, lastInsertRowid };
  }

  all(bindings?: unknown[]): Array<Record<string, unknown>> {
    const stmt = this.#db.prepare(this.#sql);
    if (bindings && bindings.length > 0) stmt.bind(bindings);
    const rows: Array<Record<string, unknown>> = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  }

  get(bindings?: unknown[]): Record<string, unknown> | undefined {
    const stmt = this.#db.prepare(this.#sql);
    if (bindings && bindings.length > 0) stmt.bind(bindings);
    if (!stmt.step()) {
      stmt.free();
      return undefined;
    }
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
}

// ── Factory ────────────────────────────────────────────────────────────────────

export async function createSqliteWasmDatabase(filename: string): Promise<SqliteWasmDatabase> {
  // sql.js is an optional peer dependency — require lazily so the module loads
  // without it installed when the driver is not selected.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const initSqlJs = require('sql.js') as (opts?: object) => Promise<SqlJsModule>;
  const SQL = await initSqlJs();

  let data: Buffer | null = null;
  if (filename !== ':memory:' && existsSync(filename)) {
    data = readFileSync(filename);
  }

  return new SqliteWasmDatabase(new SQL.Database(data), filename);
}

// ── Custom Knex dialect built on top of the better-sqlite3 client ──────────────
// We extend Knex's better-sqlite3 dialect and replace acquireRawConnection so
// that the pre-created WasmDatabase is injected instead of calling _driver().
// better-sqlite3 itself is never required when this dialect is active.

type KnexDialectBase = abstract new (...args: unknown[]) => {
  acquireRawConnection(): Promise<unknown>;
  destroyRawConnection(conn: unknown): Promise<void>;
};

export function buildSqliteWasmDialect(wasmDb: SqliteWasmDatabase): KnexDialectBase {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const BetterSqlite3Base = require('knex/lib/dialects/better-sqlite3/index.js') as KnexDialectBase;

  class SqliteWasmDialect extends BetterSqlite3Base {
    override acquireRawConnection(): Promise<SqliteWasmDatabase> {
      return Promise.resolve(wasmDb);
    }

    override destroyRawConnection(): Promise<void> {
      return Promise.resolve();
    }
  }

  return SqliteWasmDialect;
}
