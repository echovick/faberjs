#!/usr/bin/env node
/**
 * Local scaffold test — validates the scaffold without publishing to npm.
 * Usage: node scripts/test-scaffold.mjs [sqlite|mysql|postgres]
 */

import { execSync, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const PACKAGES_DIR = join(ROOT, 'packages');
const driver = process.argv[2] ?? 'sqlite';
const APP_DIR = `${process.env['HOME']}/faber-scaffold-test`;

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', ...opts });
}

function cleanup() {
  if (existsSync(APP_DIR)) rmSync(APP_DIR, { recursive: true, force: true });
}

process.on('SIGINT', () => { cleanup(); process.exit(0); });

// ── 1. Build ──────────────────────────────────────────────────────────────────
console.log('\n\x1b[36m[1/4] Building all packages...\x1b[0m');
run('pnpm build', { cwd: ROOT });

// ── 2. Scaffold directly via compiled module ───────────────────────────────────
console.log(`\n\x1b[36m[2/4] Scaffolding test app (driver=${driver})...\x1b[0m`);
cleanup();
mkdirSync(APP_DIR, { recursive: true });

const req = createRequire(import.meta.url);
const { scaffoldProject } = req(join(ROOT, 'create-faberjs', 'dist', 'scaffold.js'));
await scaffoldProject({
  projectName: 'test-app',
  targetDir: APP_DIR,
  dbDriver: driver,
  includeAuth: false,
});

console.log('\n\x1b[32m✓ Scaffolded\x1b[0m');
console.log('\nbootstrap/app.ts:');
console.log(readFileSync(join(APP_DIR, 'bootstrap', 'app.ts'), 'utf8'));

// ── 3. Wire local packages ────────────────────────────────────────────────────
console.log('\n\x1b[36m[3/4] Wiring local packages...\x1b[0m');
const pkgPath = join(APP_DIR, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

for (const dep of Object.keys(pkg.dependencies ?? {})) {
  if (dep.startsWith('@faber-js/')) {
    const name = dep.replace('@faber-js/', '');
    const localPath = join(PACKAGES_DIR, name);
    if (existsSync(localPath)) pkg.dependencies[dep] = `file:${localPath}`;
  }
}
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
run('npm install', { cwd: APP_DIR });

// ── 4. Boot test ──────────────────────────────────────────────────────────────
console.log('\n\x1b[36m[4/4] Booting server (10s timeout)...\x1b[0m');
mkdirSync(join(APP_DIR, 'storage'), { recursive: true });

const result = spawnSync('node', ['--require', 'ts-node/register', 'bootstrap/app.ts'], {
  cwd: APP_DIR,
  timeout: 10000,
  env: {
    ...process.env,
    APP_PORT: '3456',
    DB_CONNECTION: 'better-sqlite3',
    DB_DATABASE: join(APP_DIR, 'storage', 'test.sqlite'),
    TS_NODE_PROJECT: join(APP_DIR, 'tsconfig.json'),
  },
});

const out = (result.stdout?.toString() ?? '') + (result.stderr?.toString() ?? '');
console.log(out);

const started = out.includes('running on port') || result.signal === 'SIGTERM';

if (started) {
  console.log('\n\x1b[32m✓ Server started — scaffold test passed\x1b[0m\n');
  cleanup();
  process.exit(0);
} else {
  console.error('\n\x1b[31m✗ Server did not start (see output above)\x1b[0m\n');
  process.exit(1);
}
