import { program } from 'commander';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  generateFile,
  makeMigrationClassName,
  makeMigrationFileName,
  writeGeneratedFile,
} from './generator';

// Read version from package.json
function getVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as {
      version: string;
    };
    return pkg.version;
  } catch {
    return '0.0.0';
  }
}

const cwd = process.cwd();

program.name('faber').description('FaberJS CLI — the Artisan equivalent').version(getVersion());

// ── make:* generators ──────────────────────────────────────────────

const make = program.command('make').description('Generate application files');

make
  .command('controller <name>')
  .description('Create a new controller')
  .action((name: string) => {
    const result = generateFile('controller', name, cwd);
    writeGeneratedFile(result);
    process.stdout.write(`\x1b[32mCREATED\x1b[0m ${result.filePath}\n`);
  });

make
  .command('service <name>')
  .description('Create a new service')
  .action((name: string) => {
    const result = generateFile('service', name, cwd);
    writeGeneratedFile(result);
    process.stdout.write(`\x1b[32mCREATED\x1b[0m ${result.filePath}\n`);
  });

make
  .command('model <name>')
  .description('Create a new model')
  .option('-m, --migration', 'Also create a migration for this model')
  .action((name: string, options: { migration?: boolean }) => {
    const modelResult = generateFile('model', name, cwd);
    writeGeneratedFile(modelResult);
    process.stdout.write(`\x1b[32mCREATED\x1b[0m ${modelResult.filePath}\n`);

    if (options.migration) {
      const snake = name
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '');
      const migName = `create_${snake}s_table`;
      const className = makeMigrationClassName(migName);
      const fileName = makeMigrationFileName(migName);
      const migResult = generateFile('migration', migName, cwd, {
        '{{ClassName}}': className,
        '{{FileName}}': fileName,
      });
      const finalPath = migResult.filePath.replace(/[^/\\]+\.ts$/, fileName);
      writeGeneratedFile({ filePath: finalPath, content: migResult.content });
      process.stdout.write(`\x1b[32mCREATED\x1b[0m ${finalPath}\n`);
    }
  });

make
  .command('migration <name>')
  .description('Create a new migration')
  .action((name: string) => {
    const className = makeMigrationClassName(name);
    const fileName = makeMigrationFileName(name);
    const result = generateFile('migration', name, cwd, {
      '{{ClassName}}': className,
      '{{FileName}}': fileName,
    });
    const finalPath = result.filePath.replace(/[^/\\]+\.ts$/, fileName);
    writeGeneratedFile({ filePath: finalPath, content: result.content });
    process.stdout.write(`\x1b[32mCREATED\x1b[0m ${finalPath}\n`);
  });

make
  .command('job <name>')
  .description('Create a new job')
  .action((name: string) => {
    const result = generateFile('job', name, cwd);
    writeGeneratedFile(result);
    process.stdout.write(`\x1b[32mCREATED\x1b[0m ${result.filePath}\n`);
  });

make
  .command('event <name>')
  .description('Create a new event')
  .action((name: string) => {
    const result = generateFile('event', name, cwd);
    writeGeneratedFile(result);
    process.stdout.write(`\x1b[32mCREATED\x1b[0m ${result.filePath}\n`);
  });

make
  .command('listener <name>')
  .description('Create a new listener')
  .action((name: string) => {
    const result = generateFile('listener', name, cwd);
    writeGeneratedFile(result);
    process.stdout.write(`\x1b[32mCREATED\x1b[0m ${result.filePath}\n`);
  });

make
  .command('middleware <name>')
  .description('Create a new middleware')
  .action((name: string) => {
    const result = generateFile('middleware', name, cwd);
    writeGeneratedFile(result);
    process.stdout.write(`\x1b[32mCREATED\x1b[0m ${result.filePath}\n`);
  });

make
  .command('command <name>')
  .description('Create a new console command')
  .action((name: string) => {
    const result = generateFile('command', name, cwd);
    writeGeneratedFile(result);
    process.stdout.write(`\x1b[32mCREATED\x1b[0m ${result.filePath}\n`);
  });

make
  .command('provider <name>')
  .description('Create a new service provider')
  .action((name: string) => {
    const result = generateFile('provider', name, cwd);
    writeGeneratedFile(result);
    process.stdout.write(`\x1b[32mCREATED\x1b[0m ${result.filePath}\n`);
  });

make
  .command('agent <name>')
  .description('Create a new AI agent')
  .action((name: string) => {
    const result = generateFile('agent', name, cwd);
    writeGeneratedFile(result);
    process.stdout.write(`\x1b[32mCREATED\x1b[0m ${result.filePath}\n`);
  });

// ── db:* commands ──────────────────────────────────────────────────

const db = program.command('db').description('Database management commands');

db.command('migrate')
  .description('Run pending migrations')
  .action(async () => {
    const { runMigrations } = await import('./commands/db');
    await runMigrations(cwd);
  });

db.command('rollback')
  .description('Roll back the last batch of migrations')
  .action(async () => {
    const { rollbackMigrations } = await import('./commands/db');
    await rollbackMigrations(cwd);
  });

db.command('seed')
  .description('Run database seeders')
  .action(async () => {
    const { runSeeders } = await import('./commands/db');
    await runSeeders(cwd);
  });

db.command('status')
  .description('Show migration status')
  .action(async () => {
    const { showMigrationStatus } = await import('./commands/db');
    await showMigrationStatus(cwd);
  });

// ── serve ──────────────────────────────────────────────────────────

program
  .command('serve')
  .description('Start the development server with hot reload')
  .option('-p, --port <port>', 'Port to listen on', '3000')
  .action(async (options: { port: string }) => {
    const { startServer } = await import('./commands/serve');
    startServer(cwd, Number(options.port));
  });

// ── route:list ─────────────────────────────────────────────────────

program
  .command('route:list')
  .description('List all registered routes')
  .action(async () => {
    const { listRoutes } = await import('./commands/route-list');
    await listRoutes(cwd);
  });

// ── tinker ─────────────────────────────────────────────────────────

program
  .command('tinker')
  .description('Start an interactive REPL with the application context')
  .action(async () => {
    const { startTinker } = await import('./commands/tinker');
    await startTinker(cwd);
  });

program.parse(process.argv);
