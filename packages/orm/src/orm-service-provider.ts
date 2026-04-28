import { ServiceProvider } from '@faber-js/core';
import { createConnection } from './connection';
import type { ConnectionConfig, SqliteConnectionConfig, PgConnectionConfig } from './types';

export class OrmServiceProvider extends ServiceProvider {
  #config: ConnectionConfig | null = null;

  register(): void {
    this.#config = this.app.bound('config.database')
      ? this.app.make<ConnectionConfig>('config.database')
      : buildConfigFromEnv();
  }

  async boot(): Promise<void> {
    if (this.#config) {
      await createConnection(this.#config);
    }
  }
}

function buildConfigFromEnv(): ConnectionConfig {
  const client = (process.env['DB_CONNECTION'] ?? 'better-sqlite3') as ConnectionConfig['client'];

  if (client === 'sqlite3' || client === 'better-sqlite3' || client === 'sqlite-wasm') {
    const connection: SqliteConnectionConfig = {
      filename: process.env['DB_DATABASE'] ?? './storage/database.sqlite',
    };
    return { client, connection };
  }

  const connection: PgConnectionConfig = {
    host: process.env['DB_HOST'] ?? '127.0.0.1',
    port: Number(process.env['DB_PORT'] ?? (client === 'pg' ? 5432 : 3306)),
    user: process.env['DB_USERNAME'] ?? 'root',
    password: process.env['DB_PASSWORD'] ?? '',
    database: process.env['DB_DATABASE'] ?? 'faberjs',
  };
  return { client, connection };
}
