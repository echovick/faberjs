#!/usr/bin/env node
/**
 * Local scaffold test — runs without publishing to npm.
 * Usage: node scripts/test-scaffold.mjs [sqlite|mysql|postgres]
 *
 * It builds all packages, scaffolds a test app, wires up local file: references
 * so pnpm resolves from the monorepo instead of npm, then starts the server and
 * hits /health to verify it works.
 */

import { execSync, spawn } from 'node:child_process';
import { mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = resolve(import.meta.dirname, '..');
const PACKAGES_DIR = join(ROOT, 'packages');
const SCAFFOLD_BIN = join(ROOT, 'create-faberjs', 'dist', 'index.js');
const driver = process.argv[2] ?? 'sqlite';
const TEST_DIR = join(tmpdir(), `faber-test-${Date.now()}`);
const APP_DIR = join(TEST_DIR, 'test-app');

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', ...opts });
}

function cleanup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
}

process.on('exit', cleanup);
process.on('SIGINT', () => process.exit(0));

// ── 1. Build ──────────────────────────────────────────────────────────────────
console.log('\n\x1b[36m[1/4] Building all packages...\x1b[0m');
run('pnpm build', { cwd: ROOT });

// ── 2. Scaffold ───────────────────────────────────────────────────────────────
console.log('\n\x1b[36m[2/4] Scaffolding test app...\x1b[0m');
mkdirSync(TEST_DIR, { recursive: true });

// Run scaffolder non-interactively by piping answers
const scaffoldProcess = spawn('node', [SCAFFOLD_BIN, 'test-app'], {
  cwd: TEST_DIR,
  stdio: ['pipe', 'inherit', 'inherit'],
});
// Answer prompts: driver choice, auth=y
setTimeout(() => scaffoldProcess.stdin.write(`${driver}\ny\n`), 300);
await new Promise((resolve) => scaffoldProcess.on('close', resolve));

// ── 3. Swap npm refs → local file: refs ──────────────────────────────────────
console.log('\n\x1b[36m[3/4] Wiring local packages...\x1b[0m');
const pkgPath = join(APP_DIR, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

for (const [dep, _version] of Object.entries(pkg.dependencies ?? {})) {
  if (dep.startsWith('@faber-js/')) {
    const name = dep.replace('@faber-js/', '');
    const localPath = join(PACKAGES_DIR, name);
    if (existsSync(localPath)) {
      pkg.dependencies[dep] = `file:${localPath}`;
    }
  }
}

// Also wire @faber-js/console so `faber serve` uses local build
const consolePath = join(PACKAGES_DIR, 'console');
if (existsSync(consolePath)) {
  pkg.devDependencies = pkg.devDependencies ?? {};
  pkg.devDependencies['@faber-js/console'] = `file:${consolePath}`;
}

writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
run('pnpm install', { cwd: APP_DIR });

// ── 4. Smoke test ─────────────────────────────────────────────────────────────
console.log('\n\x1b[36m[4/4] Starting server and testing /health...\x1b[0m');
const server = spawn('node', [
  '--require', 'ts-node/register',
  '--env-file', '.env',
  'bootstrap/app.ts',
], { cwd: APP_DIR, stdio: 'inherit' });

await new Promise((resolve) => setTimeout(resolve, 4000));

let ok = false;
try {
  const res = await fetch('http://127.0.0.1:3000/health');
  const body = await res.json();
  ok = res.ok && body.status === 'ok';
} catch (e) {
  console.error('Fetch failed:', e.message);
}

server.kill();

if (ok) {
  console.log('\n\x1b[32m✓ Scaffold smoke test passed — /health returned {"status":"ok"}\x1b[0m\n');
  process.exit(0);
} else {
  console.error('\n\x1b[31m✗ Scaffold smoke test FAILED\x1b[0m\n');
  process.exit(1);
}
