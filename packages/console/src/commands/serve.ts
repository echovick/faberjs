import { spawn } from 'node:child_process';
import { join } from 'node:path';
import pc from 'picocolors';
import { printBanner, log } from '../ui';

export function startServer(cwd: string, port = 3000, version?: string): void {
  const entry = join(cwd, 'bootstrap', 'app.ts');

  printBanner(version);
  process.stdout.write(
    `  ${pc.dim('─'.repeat(44))}\n` +
      `  ${pc.dim('local')}    ${pc.cyan(`http://localhost:${port}`)}\n` +
      `  ${pc.dim('─'.repeat(44))}\n\n`,
  );

  const child = spawn(
    'node',
    ['--require', 'ts-node/register', '--env-file', '.env', '--watch', entry],
    {
      cwd,
      stdio: 'inherit',
      env: { ...process.env, PORT: String(port) },
    },
  );

  child.on('error', (err) => {
    log.error(`Failed to start server: ${err.message}`);
    process.exit(1);
  });

  process.on('SIGINT', () => {
    child.kill('SIGINT');
    process.exit(0);
  });
}
