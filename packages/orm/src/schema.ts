import { getConnection } from './connection';
import { Blueprint } from './blueprint';

export class Schema {
  static async create(table: string, callback: (blueprint: Blueprint) => void): Promise<void> {
    const db = getConnection();
    await db.schema.createTable(table, (builder) => {
      callback(new Blueprint(builder));
    });
  }

  static async createIfNotExists(
    table: string,
    callback: (blueprint: Blueprint) => void,
  ): Promise<void> {
    const db = getConnection();
    await db.schema.createTableIfNotExists(table, (builder) => {
      callback(new Blueprint(builder));
    });
  }

  static async drop(table: string): Promise<void> {
    await getConnection().schema.dropTable(table);
  }

  static async dropIfExists(table: string): Promise<void> {
    await getConnection().schema.dropTableIfExists(table);
  }

  static async hasTable(table: string): Promise<boolean> {
    return getConnection().schema.hasTable(table);
  }

  static async alter(table: string, callback: (blueprint: Blueprint) => void): Promise<void> {
    const db = getConnection();
    await db.schema.alterTable(table, (builder) => {
      callback(new Blueprint(builder));
    });
  }

  static async dropAll(): Promise<void> {
    const db = getConnection();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client: string = (db as any).client?.config?.client ?? '';

    let tables: string[] = [];

    if (client === 'sqlite3' || client === 'better-sqlite3') {
      const rows = (await db.raw(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      )) as Array<{ name: string }>;
      tables = rows.map((r) => r.name);
    } else if (client === 'pg') {
      const result = (await db.raw(
        "SELECT tablename AS name FROM pg_tables WHERE schemaname='public'",
      )) as { rows: Array<{ name: string }> };
      tables = result.rows.map((r) => r.name);
    } else if (client === 'mysql' || client === 'mysql2') {
      const result = (await db.raw(
        'SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE()',
      )) as [Array<{ name: string }>];
      tables = result[0].map((r) => r.name);
    }

    if (client === 'mysql' || client === 'mysql2') {
      await db.raw('SET FOREIGN_KEY_CHECKS = 0');
    }

    for (const table of tables) {
      if (client === 'pg') {
        await db.raw(`DROP TABLE IF EXISTS "${table}" CASCADE`);
      } else {
        await db.schema.dropTableIfExists(table);
      }
    }

    if (client === 'mysql' || client === 'mysql2') {
      await db.raw('SET FOREIGN_KEY_CHECKS = 1');
    }
  }
}
