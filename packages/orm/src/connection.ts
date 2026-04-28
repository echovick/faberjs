import knex, { type Knex } from 'knex';
import type { ConnectionConfig, SqliteConnectionConfig } from './types';

let _connection: Knex | null = null;

export async function createConnection(config: ConnectionConfig): Promise<Knex> {
  if (config.client === 'sqlite-wasm') {
    const { createSqliteWasmDatabase, buildSqliteWasmDialect } =
      await import('./sqlite-wasm-client');
    const filename = (config.connection as SqliteConnectionConfig).filename;
    const wasmDb = await createSqliteWasmDatabase(filename);
    const dialect = buildSqliteWasmDialect(wasmDb);
    // Knex accepts a constructor class as `client` at runtime; cast to satisfy its types.
    _connection = knex({ client: dialect as unknown as string, useNullAsDefault: true });
  } else {
    _connection = knex({
      client: config.client,
      connection: config.connection,
      useNullAsDefault: config.client === 'sqlite3' || config.client === 'better-sqlite3',
    });
  }
  return _connection;
}

export function getConnection(): Knex {
  if (!_connection) {
    throw new Error(
      'No database connection established. Call createConnection() before using the ORM.',
    );
  }
  return _connection;
}

export async function destroyConnection(): Promise<void> {
  if (_connection) {
    await _connection.destroy();
    _connection = null;
  }
}
