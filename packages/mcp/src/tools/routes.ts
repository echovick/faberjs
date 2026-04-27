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
        resolve(out.trim() || '(no routes registered)');
      } else {
        reject(new Error(err.trim() || `Process exited with code ${code}`));
      }
    });

    proc.on('error', reject);
  });
}

export async function faberRouteList(): Promise<string> {
  try {
    return await runFaber(['route:list']);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return `route:list failed:\n${message}`;
  }
}

export const routeListToolDefinition = {
  name: 'faber_route_list',
  description:
    'List all registered routes in the FaberJS application — method, path, controller, and middleware.',
  inputSchema: { type: 'object', properties: {} },
} as const;
