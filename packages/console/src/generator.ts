import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { stubs } from './stubs';

function toPascalCase(str: string): string {
  return str
    .replace(/[-_](.)/g, (_, c: string) => (c as string).toUpperCase())
    .replace(/^./, (c) => c.toUpperCase());
}

function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

function toTableName(name: string): string {
  const snake = toSnakeCase(name);
  // naive pluralisation
  if (snake.endsWith('y')) return `${snake.slice(0, -1)}ies`;
  if (snake.endsWith('s')) return snake;
  return `${snake}s`;
}

function extractTableFromMigrationName(name: string): string {
  const createMatch = /^create_(.+)_table$/.exec(name);
  if (createMatch?.[1]) return createMatch[1];
  const addMatch = /^add_.+_to_(.+)$/.exec(name);
  if (addMatch?.[1]) return addMatch[1];
  return name;
}

export interface GenerateResult {
  readonly filePath: string;
  readonly content: string;
}

export function generateFile(
  type: string,
  name: string,
  cwd: string,
  extraVars: Record<string, string> = {},
): GenerateResult {
  const stub = stubs[type];
  if (!stub) throw new Error(`Unknown generator type: ${type}`);

  const pascal = toPascalCase(name);
  const camel = toCamelCase(name);
  const table = toTableName(pascal);
  const migrationTable = type === 'migration' ? extractTableFromMigrationName(name) : table;

  const vars: Record<string, string> = {
    '{{Name}}': pascal,
    '{{name}}': camel,
    '{{table}}': table,
    '{{migrationTable}}': migrationTable,
    ...extraVars,
  };

  let content = stub;
  for (const [key, value] of Object.entries(vars)) {
    content = content.replaceAll(key, value);
  }

  const dirMap: Record<string, string> = {
    controller: join(cwd, 'app', 'controllers'),
    service: join(cwd, 'app', 'services'),
    model: join(cwd, 'app', 'models'),
    schema: join(cwd, 'schema'),
    migration: join(cwd, 'database', 'migrations'),
    job: join(cwd, 'app', 'jobs'),
    event: join(cwd, 'app', 'events'),
    listener: join(cwd, 'app', 'listeners'),
    middleware: join(cwd, 'app', 'middleware'),
    command: join(cwd, 'app', 'commands'),
    provider: join(cwd, 'app', 'providers'),
    agent: join(cwd, 'app', 'agents'),
    channel: join(cwd, 'app', 'channels'),
    mail: join(cwd, 'app', 'mail'),
  };

  const dir = dirMap[type];
  if (!dir) throw new Error(`No output directory mapped for type: ${type}`);

  const fileNameMap: Record<string, string> = {
    controller: `${pascal}Controller.ts`,
    service: `${pascal}Service.ts`,
    model: `${pascal}.ts`,
    schema: `${pascal}.ts`,
    migration: extraVars['{{FileName}}'] ?? `${pascal}.ts`,
    job: `${pascal}Job.ts`,
    event: `${pascal}Event.ts`,
    listener: `${pascal}Listener.ts`,
    middleware: `${pascal}Middleware.ts`,
    command: `${pascal}Command.ts`,
    provider: `${pascal}ServiceProvider.ts`,
    agent: `${pascal}Agent.ts`,
    channel: `${pascal}Channel.ts`,
    mail: `${pascal}Mail.ts`,
  };

  const fileName = fileNameMap[type] ?? `${pascal}.ts`;
  const filePath = join(dir, fileName);

  return { filePath, content };
}

export function writeGeneratedFile(result: GenerateResult): void {
  const dir = dirname(result.filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(result.filePath, result.content, 'utf8');
}

export function makeMigrationClassName(name: string): string {
  // e.g. "create_users_table" → "CreateUsersTable"
  return name
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

export function makeMigrationFileName(name: string): string {
  const date = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  const timestamp = `${date.getFullYear()}_${pad(date.getMonth() + 1)}_${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `${timestamp}_${name}.ts`;
}

export function generateViewFile(name: string, cwd: string): GenerateResult {
  const segments = name.split(/[/\\]/);
  const lastName = segments[segments.length - 1];
  const componentName = toPascalCase(lastName);
  const dirSegments = segments.slice(0, -1);

  const viewsBase = join(cwd, 'resources', 'views');
  const outDir = dirSegments.length > 0 ? join(viewsBase, ...dirSegments) : viewsBase;
  const filePath = join(outDir, `${componentName}.view.tsx`);

  const stub = stubs.view;
  const content = stub.replaceAll('{{Name}}', componentName);

  return { filePath, content };
}
