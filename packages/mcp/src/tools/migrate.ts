import { spawn } from 'node:child_process';

function runFaber(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['faber', ...args], {
      cwd: process.cwd(),
      env: process.env,
      shell: true,
    });

    let out = '';
    let err = '';

    proc.stdout.on('data', (d: Buffer) => {
      out += d.toString();
    });
    proc.stderr.on('data', (d: Buffer) => {
      err += d.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(out.trim() || 'Done.');
      } else {
        reject(new Error(err.trim() || `Process exited with code ${code}`));
      }
    });

    proc.on('error', reject);
  });
}

export async function faberMigrate(): Promise<string> {
  try {
    return await runFaber(['db:migrate']);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return `Migration failed:\n${message}`;
  }
}

export async function faberRollback(): Promise<string> {
  try {
    return await runFaber(['db:rollback']);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return `Rollback failed:\n${message}`;
  }
}

export async function faberDbStatus(): Promise<string> {
  try {
    return await runFaber(['db:status']);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return `db:status failed:\n${message}`;
  }
}

export const migrateToolDefinition = {
  name: 'faber_migrate',
  description: 'Run all pending FaberJS database migrations.',
  inputSchema: { type: 'object', properties: {} },
} as const;

export const rollbackToolDefinition = {
  name: 'faber_rollback',
  description: 'Rollback the last batch of FaberJS database migrations.',
  inputSchema: { type: 'object', properties: {} },
} as const;

export const dbStatusToolDefinition = {
  name: 'faber_db_status',
  description:
    'Show the status of all FaberJS database migrations (which have run, which are pending).',
  inputSchema: { type: 'object', properties: {} },
} as const;
