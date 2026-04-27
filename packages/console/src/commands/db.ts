import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MigrationRunner, createConnection } from '@faber-js/orm';
import type { Migration, ConnectionConfig } from '@faber-js/orm';

function loadDotEnv(cwd: string): void {
  const envPath = join(cwd, '.env');
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = val;
  }
}

function buildConnectionConfig(): ConnectionConfig {
  const client = (process.env['DB_CONNECTION'] ?? 'better-sqlite3') as ConnectionConfig['client'];
  if (client === 'sqlite3' || client === 'better-sqlite3') {
    return {
      client,
      connection: { filename: process.env['DB_DATABASE'] ?? './storage/database.sqlite' },
    };
  }
  return {
    client,
    connection: {
      host: process.env['DB_HOST'] ?? '127.0.0.1',
      port: Number(process.env['DB_PORT'] ?? (client === 'pg' ? 5432 : 3306)),
      user: process.env['DB_USERNAME'] ?? 'root',
      password: process.env['DB_PASSWORD'] ?? '',
      database: process.env['DB_DATABASE'] ?? 'faberjs',
    },
  };
}

function registerTsNode(cwd: string): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const tsNode = require('ts-node') as { register(opts: Record<string, unknown>): void };
    tsNode.register({ project: join(cwd, 'tsconfig.json'), transpileOnly: true });
  } catch {
    // ts-node not installed — migrations must be pre-compiled .js files
  }
}

async function loadMigrations(cwd: string): Promise<MigrationRunner> {
  registerTsNode(cwd);
  const runner = new MigrationRunner();
  const migrationsDir = join(cwd, 'database', 'migrations');

  if (!existsSync(migrationsDir)) {
    return runner;
  }

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.ts') || f.endsWith('.js'))
    .sort();

  for (const file of files) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(join(migrationsDir, file)) as { default?: new () => Migration };
    if (mod.default) {
      runner.register(file.replace(/\.(ts|js)$/, ''), new mod.default());
    }
  }

  return runner;
}

export async function runMigrations(cwd: string): Promise<void> {
  loadDotEnv(cwd);
  createConnection(buildConnectionConfig());
  const runner = await loadMigrations(cwd);
  const executed = await runner.run();
  if (executed.length === 0) {
    process.stdout.write('Nothing to migrate.\n');
  } else {
    for (const name of executed) {
      process.stdout.write(`\x1b[32mMIGRATED\x1b[0m ${name}\n`);
    }
  }
}

export async function rollbackMigrations(cwd: string): Promise<void> {
  loadDotEnv(cwd);
  createConnection(buildConnectionConfig());
  const runner = await loadMigrations(cwd);
  const rolled = await runner.rollback();
  if (rolled.length === 0) {
    process.stdout.write('Nothing to roll back.\n');
  } else {
    for (const name of rolled) {
      process.stdout.write(`\x1b[33mROLLED BACK\x1b[0m ${name}\n`);
    }
  }
}

export async function runSeeders(cwd: string): Promise<void> {
  loadDotEnv(cwd);
  createConnection(buildConnectionConfig());
  const seedersDir = join(cwd, 'database', 'seeders');
  if (!existsSync(seedersDir)) {
    process.stdout.write('No seeders directory found.\n');
    return;
  }
  const files = readdirSync(seedersDir)
    .filter((f) => f.endsWith('.ts') || f.endsWith('.js'))
    .sort();
  for (const file of files) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(join(seedersDir, file)) as { default?: { run(): Promise<void> } };
    if (mod.default) {
      await mod.default.run();
      process.stdout.write(`\x1b[32mSEEDED\x1b[0m ${file}\n`);
    }
  }
}

export async function showMigrationStatus(cwd: string): Promise<void> {
  loadDotEnv(cwd);
  createConnection(buildConnectionConfig());
  const runner = await loadMigrations(cwd);
  const records = await runner.status();
  if (records.length === 0) {
    process.stdout.write('No migrations have been run.\n');
    return;
  }
  process.stdout.write('\n  Migration                          Batch\n');
  process.stdout.write('  ─────────────────────────────────  ─────\n');
  for (const r of records) {
    process.stdout.write(`  ${r.migration.padEnd(33)}  ${r.batch}\n`);
  }
  process.stdout.write('\n');
}
