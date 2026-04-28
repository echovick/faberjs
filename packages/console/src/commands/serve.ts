import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { join } from 'node:path';
import pc from 'picocolors';
import { printBanner, log } from '../ui';

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '127.0.0.1');
  });
}

async function findAvailablePort(start: number, max = 20): Promise<number> {
  for (let offset = 0; offset < max; offset++) {
    if (await isPortAvailable(start + offset)) return start + offset;
  }
  throw new Error(`No available port found in range ${start}–${start + max - 1}`);
}

export async function startServer(cwd: string, port = 3000, version?: string): Promise<void> {
  const entry = join(cwd, 'bootstrap', 'app.ts');

  const actualPort = await findAvailablePort(port);

  printBanner(version);

  if (actualPort !== port) {
    process.stdout.write(`  ${pc.yellow(`Port ${port} in use — using ${actualPort} instead`)}\n`);
  }

  process.stdout.write(
    `  ${pc.dim('─'.repeat(44))}\n` +
      `  ${pc.dim('local')}    ${pc.cyan(`http://localhost:${actualPort}`)}\n` +
      `  ${pc.dim('─'.repeat(44))}\n\n`,
  );

  const child = spawn(
    'node',
    ['--require', 'ts-node/register', '--env-file', '.env', '--watch', entry],
    {
      cwd,
      stdio: 'inherit',
      env: { ...process.env, PORT: String(actualPort), APP_PORT: String(actualPort) },
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
