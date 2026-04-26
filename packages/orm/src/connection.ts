import knex, { type Knex } from 'knex';
import type { ConnectionConfig } from './types';

let _connection: Knex | null = null;

export function createConnection(config: ConnectionConfig): Knex {
  _connection = knex({
    client: config.client,
    connection: config.connection,
    useNullAsDefault: config.client === 'sqlite3' || config.client === 'better-sqlite3',
  });
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
