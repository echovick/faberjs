import { Schema } from './schema';
import { getConnection } from './connection';
import type { MigrationRecord } from './types';

export abstract class Migration {
  abstract up(): Promise<void>;
  abstract down(): Promise<void>;
}

const MIGRATIONS_TABLE = 'faber_migrations';

export class MigrationRunner {
  readonly #migrations: Map<string, Migration>;

  constructor(migrations: Map<string, Migration> = new Map<string, Migration>()) {
    this.#migrations = migrations;
  }

  register(name: string, migration: Migration): this {
    this.#migrations.set(name, migration);
    return this;
  }

  async #ensureMigrationsTable(): Promise<void> {
    const exists = await Schema.hasTable(MIGRATIONS_TABLE);
    if (!exists) {
      await Schema.create(MIGRATIONS_TABLE, (table) => {
        table.id();
        table.string('migration');
        table.integer('batch');
      });
    }
  }

  async #getRan(): Promise<string[]> {
    const db = getConnection();
    const rows: Array<{ migration: string }> = await db(MIGRATIONS_TABLE).select('migration');
    return rows.map((r) => r.migration);
  }

  async #getLastBatch(): Promise<number> {
    const db = getConnection();
    const result = await db(MIGRATIONS_TABLE).max('batch as max');
    const row = (result as Array<Record<string, unknown>>)[0];
    if (!row) return 0;
    return Number(row['max'] ?? 0);
  }

  async run(): Promise<string[]> {
    await this.#ensureMigrationsTable();
    const ran = await this.#getRan();
    const pending = [...this.#migrations.entries()].filter(([name]) => !ran.includes(name));
    if (pending.length === 0) return [];

    const batch = (await this.#getLastBatch()) + 1;
    const db = getConnection();
    const executed: string[] = [];

    for (const [name, migration] of pending) {
      await migration.up();
      await db(MIGRATIONS_TABLE).insert({ migration: name, batch });
      executed.push(name);
    }

    return executed;
  }

  async rollback(): Promise<string[]> {
    await this.#ensureMigrationsTable();
    const batch = await this.#getLastBatch();
    if (batch === 0) return [];

    const db = getConnection();
    const rows: Array<{ migration: string }> = await db(MIGRATIONS_TABLE)
      .where('batch', batch)
      .orderBy('id', 'desc')
      .select('migration');

    const rolled: string[] = [];
    for (const { migration: name } of rows) {
      const migration = this.#migrations.get(name);
      if (migration) {
        await migration.down();
        rolled.push(name);
      }
      await db(MIGRATIONS_TABLE).where('migration', name).delete();
    }

    return rolled;
  }

  async status(): Promise<MigrationRecord[]> {
    await this.#ensureMigrationsTable();
    const db = getConnection();
    return db(MIGRATIONS_TABLE).orderBy('id').select('*') as Promise<MigrationRecord[]>;
  }

  async reset(): Promise<string[]> {
    await this.#ensureMigrationsTable();
    const db = getConnection();
    const rows: Array<{ migration: string }> = await db(MIGRATIONS_TABLE)
      .orderBy('id', 'desc')
      .select('migration');
    const rolled: string[] = [];
    for (const { migration: name } of rows) {
      const migration = this.#migrations.get(name);
      if (migration) {
        await migration.down();
        rolled.push(name);
      }
      await db(MIGRATIONS_TABLE).where('migration', name).delete();
    }
    return rolled;
  }
}
