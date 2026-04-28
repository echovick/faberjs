import { program } from 'commander';
import {
  generateFile,
  generateViewFile,
  makeMigrationClassName,
  makeMigrationFileName,
  writeGeneratedFile,
} from './generator';
import { bannerLines, getVersion, log } from './ui';

const version = getVersion();
const cwd = process.cwd();

program
  .name('faber')
  .description('FaberJS CLI — the Artisan equivalent')
  .version(version)
  .addHelpText('beforeAll', bannerLines(version));

// Show banner + help when run with no subcommand
program.action(() => {
  process.stdout.write(bannerLines(version) + '\n');
  program.help({ error: false });
});

// ── make:* generators ──────────────────────────────────────────────

program
  .command('make:controller <name>')
  .description('Create a new controller')
  .action((name: string) => {
    const result = generateFile('controller', name, cwd);
    writeGeneratedFile(result);
    log.created(result.filePath);
  });

program
  .command('make:service <name>')
  .description('Create a new service')
  .action((name: string) => {
    const result = generateFile('service', name, cwd);
    writeGeneratedFile(result);
    log.created(result.filePath);
  });

program
  .command('make:model <name>')
  .description('Create a new model')
  .option('-m, --migration', 'Also create a migration for this model')
  .action((name: string, options: { migration?: boolean }) => {
    const modelResult = generateFile('model', name, cwd);
    writeGeneratedFile(modelResult);
    log.created(modelResult.filePath);

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
      log.created(finalPath);
    }
  });

program
  .command('make:migration <name>')
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
    log.created(finalPath);
  });

program
  .command('make:job <name>')
  .description('Create a new job')
  .action((name: string) => {
    const result = generateFile('job', name, cwd);
    writeGeneratedFile(result);
    log.created(result.filePath);
  });

program
  .command('make:event <name>')
  .description('Create a new event')
  .action((name: string) => {
    const result = generateFile('event', name, cwd);
    writeGeneratedFile(result);
    log.created(result.filePath);
  });

program
  .command('make:listener <name>')
  .description('Create a new listener')
  .action((name: string) => {
    const result = generateFile('listener', name, cwd);
    writeGeneratedFile(result);
    log.created(result.filePath);
  });

program
  .command('make:middleware <name>')
  .description('Create a new middleware')
  .action((name: string) => {
    const result = generateFile('middleware', name, cwd);
    writeGeneratedFile(result);
    log.created(result.filePath);
  });

program
  .command('make:command <name>')
  .description('Create a new console command')
  .action((name: string) => {
    const result = generateFile('command', name, cwd);
    writeGeneratedFile(result);
    log.created(result.filePath);
  });

program
  .command('make:provider <name>')
  .description('Create a new service provider')
  .action((name: string) => {
    const result = generateFile('provider', name, cwd);
    writeGeneratedFile(result);
    log.created(result.filePath);
  });

program
  .command('make:agent <name>')
  .description('Create a new AI agent')
  .action((name: string) => {
    const result = generateFile('agent', name, cwd);
    writeGeneratedFile(result);
    log.created(result.filePath);
  });

program
  .command('make:schema <name>')
  .description('Create a new schema-first model declaration')
  .action((name: string) => {
    const result = generateFile('schema', name, cwd);
    writeGeneratedFile(result);
    log.created(result.filePath);
  });

program
  .command('make:view <name>')
  .description('Create a new JSX view (e.g. users/index, Dashboard)')
  .action((name: string) => {
    const result = generateViewFile(name, cwd);
    writeGeneratedFile(result);
    log.created(result.filePath);
  });

// ── db:* commands ──────────────────────────────────────────────────

program
  .command('db:migrate')
  .description('Run pending migrations')
  .action(async () => {
    const { runMigrations } = await import('./commands/db');
    await runMigrations(cwd);
  });

program
  .command('db:rollback')
  .description('Roll back the last batch of migrations')
  .action(async () => {
    const { rollbackMigrations } = await import('./commands/db');
    await rollbackMigrations(cwd);
  });

program
  .command('db:seed')
  .description('Run database seeders')
  .action(async () => {
    const { runSeeders } = await import('./commands/db');
    await runSeeders(cwd);
  });

program
  .command('db:status')
  .description('Show migration status')
  .action(async () => {
    const { showMigrationStatus } = await import('./commands/db');
    await showMigrationStatus(cwd);
  });

// ── bridge:* commands ─────────────────────────────────────────────

program
  .command('bridge:types')
  .description('Generate BridgePages type map from resources/pages/')
  .option('--pages <dir>', 'Pages directory', 'resources/pages')
  .option('--out <file>', 'Output file', 'resources/types/bridge.generated.ts')
  .action(async (options: { pages: string; out: string }) => {
    const { generateBridgeTypes } = await import('./commands/bridge-types');
    await generateBridgeTypes(cwd, options.pages, options.out);
  });

// ── serve ──────────────────────────────────────────────────────────

program
  .command('serve')
  .description('Start the development server with hot reload')
  .option('-p, --port <port>', 'Port to listen on', '3000')
  .action(async (options: { port: string }) => {
    const { startServer } = await import('./commands/serve');
    startServer(cwd, Number(options.port), version);
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
