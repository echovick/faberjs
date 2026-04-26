import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { MigrationRunner } from '@faberjs/orm';
import type { Migration } from '@faberjs/orm';

async function loadMigrations(cwd: string): Promise<MigrationRunner> {
  const runner = new MigrationRunner();
  const migrationsDir = join(cwd, 'database', 'migrations');

  if (!existsSync(migrationsDir)) {
    return runner;
  }

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.ts') || f.endsWith('.js'))
    .sort();

  for (const file of files) {
    const mod = (await import(join(migrationsDir, file))) as { default?: Migration };
    if (mod.default) {
      runner.register(file.replace(/\.(ts|js)$/, ''), mod.default);
    }
  }

  return runner;
}

export async function runMigrations(cwd: string): Promise<void> {
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
  const seedersDir = join(cwd, 'database', 'seeders');
  if (!existsSync(seedersDir)) {
    process.stdout.write('No seeders directory found.\n');
    return;
  }
  const files = readdirSync(seedersDir)
    .filter((f) => f.endsWith('.ts') || f.endsWith('.js'))
    .sort();
  for (const file of files) {
    const mod = (await import(join(seedersDir, file))) as { default?: { run(): Promise<void> } };
    if (mod.default) {
      await mod.default.run();
      process.stdout.write(`\x1b[32mSEEDED\x1b[0m ${file}\n`);
    }
  }
}

export async function showMigrationStatus(cwd: string): Promise<void> {
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
