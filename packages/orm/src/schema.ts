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
}
