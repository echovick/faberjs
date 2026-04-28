import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { log } from '../ui';

// Inline bootstrap script executed in the user's app context via a child
// node process. Runs with ts-node and .env loaded so TypeScript models work
// and DB credentials are available without starting the HTTP server.
const TINKER_BOOTSTRAP = `
require('ts-node').register({ transpileOnly: true });
require('reflect-metadata');

const path = require('node:path');
const fs = require('node:fs');
const repl = require('node:repl');

process.stdout.write('\\x1b[36mFaberJS Tinker\\x1b[0m \\x1b[2m— Type .exit to quit\\x1b[0m\\n\\n');

(async () => {
  // Set up DB connection from env vars (same logic as OrmServiceProvider)
  try {
    const { createConnection } = require('@faber-js/orm');
    const client = process.env.DB_CONNECTION || 'better-sqlite3';
    let connection;
    if (client === 'sqlite3' || client === 'better-sqlite3' || client === 'sqlite-wasm') {
      connection = { filename: process.env.DB_DATABASE || './storage/database.sqlite' };
    } else {
      connection = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || (client === 'pg' ? 5432 : 3306)),
        user: process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_DATABASE || 'faberjs',
      };
    }
    await createConnection({ client, connection });
  } catch (e) {
    process.stderr.write('\\x1b[33mWarning\\x1b[0m DB: ' + e.message + '\\n');
  }

  // Auto-discover and require every model from app/models/
  const ctx = {};
  const modelsDir = path.join(process.cwd(), 'app', 'models');
  const loaded = [];
  if (fs.existsSync(modelsDir)) {
    for (const file of fs.readdirSync(modelsDir).sort()) {
      if (!file.endsWith('.ts') && !file.endsWith('.js')) continue;
      try {
        const mod = require(path.join(modelsDir, file));
        for (const [k, v] of Object.entries(mod)) {
          if (k !== 'default') { ctx[k] = v; loaded.push(k); }
        }
      } catch (e) {
        process.stderr.write('  \\x1b[31m✗\\x1b[0m ' + file + ': ' + e.message + '\\n');
      }
    }
  }

  // Also expose DB for raw queries
  try {
    const orm = require('@faber-js/orm');
    ctx.DB = orm.DB;
    ctx.getConnection = orm.getConnection;
  } catch {}

  if (loaded.length > 0) {
    process.stdout.write('  \\x1b[2mLoaded: ' + loaded.join(', ') + '\\x1b[0m\\n\\n');
  }

  const server = repl.start({ prompt: '>>> ', useGlobal: false });
  Object.assign(server.context, ctx);
  server.on('exit', () => process.exit(0));
})().catch(e => {
  process.stderr.write(e.message + '\\n');
  process.exit(1);
});
`;

export async function startTinker(cwd: string): Promise<void> {
  const envFile = join(cwd, '.env');
  const nodeArgs = existsSync(envFile)
    ? ['--env-file', '.env', '-e', TINKER_BOOTSTRAP]
    : ['-e', TINKER_BOOTSTRAP];

  await new Promise<void>((resolve, reject) => {
    const child = spawn('node', nodeArgs, {
      cwd,
      stdio: 'inherit',
      env: { ...process.env },
    });
    child.on('close', resolve);
    child.on('error', (err) => {
      log.error(`Failed to start tinker: ${err.message}`);
      reject(err);
    });
  });
}
