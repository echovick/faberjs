import { spawn } from 'node:child_process';

const VALID_TYPES = [
  'controller',
  'model',
  'service',
  'job',
  'event',
  'listener',
  'middleware',
  'migration',
  'provider',
  'command',
  'agent',
  'schema',
  'view',
  'channel',
  'mail',
  'policy',
];

function runCommand(args: string[]): Promise<string> {
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

export async function faberMake(type: string, name: string, flags: string[] = []): Promise<string> {
  if (!VALID_TYPES.includes(type.toLowerCase())) {
    return `Unknown generator type "${type}". Valid types: ${VALID_TYPES.join(', ')}`;
  }

  const args = [`make:${type.toLowerCase()}`, name, ...flags];

  try {
    const output = await runCommand(args);
    return output;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return `Error running faber make:${type} ${name}:\n${message}`;
  }
}

export const makeToolDefinition = {
  name: 'faber_make',
  description:
    'Generate a FaberJS file using the faber CLI. Creates controllers, models, services, jobs, events, listeners, migrations, and more in the correct directory with the correct boilerplate.',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description: `The type of file to generate. One of: ${VALID_TYPES.join(', ')}`,
        enum: VALID_TYPES,
      },
      name: {
        type: 'string',
        description:
          'The name of the file to generate (PascalCase for classes, snake_case for migrations). Example: "PostController", "CreatePostsTable"',
      },
      withMigration: {
        type: 'boolean',
        description: 'Only for type=model. When true, also creates a migration file (-m flag).',
      },
    },
    required: ['type', 'name'],
  },
} as const;
