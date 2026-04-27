import { spawn } from 'node:child_process';
import { join } from 'node:path';

export function startServer(cwd: string, port = 3000): void {
  const entry = join(cwd, 'bootstrap', 'app.ts');
  process.stdout.write(`\x1b[36mINFO\x1b[0m  Starting server on port ${port}...\n`);

  const child = spawn('node', ['--loader', 'ts-node/esm', '--env-file', '.env', '--watch', entry], {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, PORT: String(port) },
  });

  child.on('error', (err) => {
    process.stderr.write(`\x1b[31mERROR\x1b[0m Failed to start server: ${err.message}\n`);
    process.exit(1);
  });

  process.on('SIGINT', () => {
    child.kill('SIGINT');
    process.exit(0);
  });
}
