import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface ScaffoldOptions {
  readonly projectName: string;
  readonly targetDir: string;
  readonly dbDriver: 'sqlite' | 'postgres' | 'mysql';
  readonly includeAuth: boolean;
}

type FileMap = Record<string, string>;

function buildFiles(opts: ScaffoldOptions): FileMap {
  const { projectName, dbDriver, includeAuth } = opts;

  const dbConfig = buildDbConfig(dbDriver);
  const authImports = includeAuth
    ? `\nimport { AuthServiceProvider } from '../app/providers/AuthServiceProvider';`
    : '';
  const authProvider = includeAuth ? `  app.register(new AuthServiceProvider(app));` : '';

  return {
    'package.json': JSON.stringify(
      {
        name: projectName,
        version: '0.0.1',
        private: true,
        scripts: {
          dev: 'faber serve',
          migrate: 'faber db migrate',
          'migrate:rollback': 'faber db rollback',
        },
        dependencies: {
          '@faber-js/core': '^1.0.7',
          '@faber-js/config': '^1.0.7',
          '@faber-js/http': '^1.0.7',
          '@faber-js/router': '^1.0.7',
          '@faber-js/orm': '^1.0.7',
          '@faber-js/queue': '^1.0.7',
          '@faber-js/events': '^1.0.7',
          '@faber-js/validation': '^1.0.7',
          '@faber-js/console': '^1.0.10',
          ...(includeAuth ? { '@faber-js/auth': '^1.0.7' } : {}),
          'reflect-metadata': '^0.2.2',
          ...dbConfig.driverDep,
        },
        devDependencies: {
          typescript: '^5.8.3',
          'ts-node': '^10.9.0',
          '@types/node': '^20.19.0',
        },
      },
      null,
      2,
    ),

    'tsconfig.json': JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'CommonJS',
          moduleResolution: 'Node',
          lib: ['ES2022'],
          outDir: 'dist',
          rootDir: '.',
          strict: true,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          esModuleInterop: true,
          resolveJsonModule: true,
          skipLibCheck: true,
          declaration: true,
          declarationMap: true,
          sourceMap: true,
        },
        include: ['**/*.ts'],
        exclude: ['node_modules', 'dist'],
      },
      null,
      2,
    ),

    '.env': [
      `APP_NAME="${projectName}"`,
      'APP_PORT=3000',
      '',
      ...dbConfig.envLines,
      '',
      'JWT_SECRET=change-me-in-production',
    ].join('\n'),

    '.env.example': [
      `APP_NAME="${projectName}"`,
      'APP_PORT=3000',
      '',
      ...dbConfig.exampleLines,
      '',
      'JWT_SECRET=your-jwt-secret',
    ].join('\n'),

    '.gitignore': ['node_modules', 'dist', '.env', '*.tsbuildinfo', 'storage/'].join('\n'),

    'faber.config.ts': [
      `export default {`,
      `  name: '${projectName}',`,
      `  port: Number(process.env['APP_PORT'] ?? 3000),`,
      `};`,
    ].join('\n'),

    'bootstrap/app.ts': [
      `import 'reflect-metadata';`,
      `import { Application } from '@faber-js/core';`,
      `import { HttpServiceProvider, HttpKernel } from '@faber-js/http';`,
      `import { RouterServiceProvider } from '@faber-js/router';`,
      `import { OrmServiceProvider } from '@faber-js/orm';`,
      authImports,
      ``,
      `void (async () => {`,
      `  const app = new Application();`,
      ``,
      `  app.register(new HttpServiceProvider(app));`,
      `  app.register(new RouterServiceProvider(app));`,
      `  app.register(new OrmServiceProvider(app));`,
      ...(authProvider ? [authProvider] : []),
      ``,
      `  await app.boot();`,
      ``,
      `  // Load routes`,
      `  require('../routes/api');`,
      ``,
      `  const kernel = app.make<HttpKernel>('http.kernel');`,
      `  const port = Number(process.env['APP_PORT'] ?? 3000);`,
      `  await kernel.listen(port);`,
      ``,
      `  console.log(\`Server running on port \${port}\`);`,
      `})();`,
    ].join('\n'),

    'routes/api.ts': [
      `import { Route } from '@faber-js/router';`,
      `import { Response } from '@faber-js/http';`,
      `import { UserController } from '../app/controllers/UserController';`,
      ``,
      `Route.get('/health', () => Promise.resolve(Response.json({ status: 'ok' })));`,
      ``,
      `Route.group({ prefix: '/api/v1' }, () => {`,
      `  Route.get('/users', [UserController, 'index']);`,
      `  Route.post('/users', [UserController, 'store']);`,
      `  Route.get('/users/:id', [UserController, 'show']);`,
      `  Route.put('/users/:id', [UserController, 'update']);`,
      `  Route.delete('/users/:id', [UserController, 'destroy']);`,
      `});`,
    ].join('\n'),

    'app/controllers/UserController.ts': [
      `import { Injectable } from '@faber-js/core';`,
      `import { Controller } from '@faber-js/router';`,
      `import type { Request } from '@faber-js/http';`,
      `import { Response } from '@faber-js/http';`,
      `import { UserService } from '../services/UserService';`,
      ``,
      `@Injectable()`,
      `export class UserController extends Controller {`,
      `  constructor(private readonly userService: UserService) {`,
      `    super();`,
      `  }`,
      ``,
      `  async index(_req: Request): Promise<Response> {`,
      `    const users = await this.userService.all();`,
      `    return this.json({ data: users });`,
      `  }`,
      ``,
      `  async store(req: Request): Promise<Response> {`,
      `    const user = await this.userService.create(req.all());`,
      `    return this.json({ data: user }, 201);`,
      `  }`,
      ``,
      `  async show(req: Request): Promise<Response> {`,
      `    const user = await this.userService.find(Number(req.route('id')));`,
      `    return this.json({ data: user });`,
      `  }`,
      ``,
      `  async update(req: Request): Promise<Response> {`,
      `    const user = await this.userService.update(Number(req.route('id')), req.all());`,
      `    return this.json({ data: user });`,
      `  }`,
      ``,
      `  async destroy(req: Request): Promise<Response> {`,
      `    await this.userService.delete(Number(req.route('id')));`,
      `    return this.noContent();`,
      `  }`,
      `}`,
    ].join('\n'),

    'app/services/UserService.ts': [
      `import { Injectable, Service } from '@faber-js/core';`,
      `import { User } from '../models/User';`,
      ``,
      `@Injectable()`,
      `export class UserService extends Service {`,
      `  async all(): Promise<User[]> {`,
      `    return User.all<User>();`,
      `  }`,
      ``,
      `  async find(id: number): Promise<User | null> {`,
      `    return User.find<User>(id);`,
      `  }`,
      ``,
      `  async create(attrs: Record<string, unknown>): Promise<User> {`,
      `    return User.create<User>(attrs as Record<string, string | number | boolean | null>);`,
      `  }`,
      ``,
      `  async update(id: number, attrs: Record<string, unknown>): Promise<User | null> {`,
      `    const user = await User.find<User>(id);`,
      `    if (!user) return null;`,
      `    await user.update(attrs as Record<string, string | number | boolean | null>);`,
      `    return user;`,
      `  }`,
      ``,
      `  async delete(id: number): Promise<void> {`,
      `    const user = await User.find<User>(id);`,
      `    if (user) await user.delete();`,
      `  }`,
      `}`,
    ].join('\n'),

    'app/models/User.ts': [
      `import { Model } from '@faber-js/orm';`,
      ``,
      `export class User extends Model {`,
      `  static table = 'users';`,
      `  static fillable = ['name', 'email', 'password'];`,
      `  static hidden = ['password'];`,
      `}`,
    ].join('\n'),

    ...(includeAuth
      ? {
          'app/providers/AuthServiceProvider.ts': [
            `import { AuthServiceProvider as BaseAuthServiceProvider } from '@faber-js/auth';`,
            `import type { AuthConfig, UserProviderContract } from '@faber-js/auth';`,
            `import type { AuthUser } from '@faber-js/http';`,
            ``,
            `export class AuthServiceProvider extends BaseAuthServiceProvider {`,
            `  protected authConfig(): AuthConfig {`,
            `    return {`,
            `      secret: process.env['JWT_SECRET'] ?? 'change-me',`,
            `      expiresIn: '7d',`,
            `    };`,
            `  }`,
            ``,
            `  protected userProvider(): UserProviderContract {`,
            `    return {`,
            `      async findByCredentials(_credentials: Record<string, unknown>): Promise<AuthUser | null> {`,
            `        // TODO: look up user by email/password`,
            `        return null;`,
            `      },`,
            `      async findById(_id: string | number): Promise<AuthUser | null> {`,
            `        // TODO: look up user by id`,
            `        return null;`,
            `      },`,
            `    };`,
            `  }`,
            `}`,
          ].join('\n'),
        }
      : {}),

    'app/providers/AppServiceProvider.ts': [
      `import { ServiceProvider } from '@faber-js/core';`,
      ``,
      `export class AppServiceProvider extends ServiceProvider {`,
      `  register(): void {`,
      `    // Register application bindings here`,
      `  }`,
      ``,
      `  async boot(): Promise<void> {`,
      `    // Run after all providers are registered`,
      `  }`,
      `}`,
    ].join('\n'),

    'database/migrations/0001_create_users_table.ts': [
      `import { Migration, Schema } from '@faber-js/orm';`,
      ``,
      `export default class CreateUsersTable extends Migration {`,
      `  async up(): Promise<void> {`,
      `    await Schema.create('users', (table) => {`,
      `      table.id();`,
      `      table.string('name');`,
      `      table.string('email').unique();`,
      `      table.string('password');`,
      `      table.timestamps();`,
      `    });`,
      `  }`,
      ``,
      `  async down(): Promise<void> {`,
      `    await Schema.dropIfExists('users');`,
      `  }`,
      `}`,
    ].join('\n'),

    'config/app.ts': [
      `import { env } from '@faber-js/config';`,
      ``,
      `export default {`,
      `  name: env('APP_NAME', '${projectName}'),`,
      `  port: env('APP_PORT', 3000),`,
      `};`,
    ].join('\n'),

    'config/database.ts': [
      `import { env } from '@faber-js/config';`,
      ``,
      `export default {`,
      `  default: env('DB_CONNECTION', '${dbDriver}'),`,
      `  connections: {`,
      ...dbConfig.configLines,
      `  },`,
      `};`,
    ].join('\n'),
  };
}

function buildDbConfig(driver: ScaffoldOptions['dbDriver']): {
  envLines: string[];
  exampleLines: string[];
  configLines: string[];
  driverDep: Record<string, string>;
} {
  if (driver === 'sqlite') {
    return {
      driverDep: { 'better-sqlite3': '^9.4.0' },
      envLines: ['DB_CONNECTION=better-sqlite3', 'DB_DATABASE=./storage/database.sqlite'],
      exampleLines: ['DB_CONNECTION=better-sqlite3', 'DB_DATABASE=./storage/database.sqlite'],
      configLines: [
        `    'better-sqlite3': {`,
        `      client: 'better-sqlite3',`,
        `      connection: { filename: env('DB_DATABASE', './storage/database.sqlite') },`,
        `    },`,
      ],
    };
  }

  if (driver === 'mysql') {
    return {
      driverDep: { mysql2: '^3.11.0' },
      envLines: [
        'DB_CONNECTION=mysql2',
        'DB_HOST=127.0.0.1',
        'DB_PORT=3306',
        'DB_DATABASE=faberjs',
        'DB_USERNAME=root',
        'DB_PASSWORD=',
      ],
      exampleLines: [
        'DB_CONNECTION=mysql2',
        'DB_HOST=127.0.0.1',
        'DB_PORT=3306',
        'DB_DATABASE=faberjs',
        'DB_USERNAME=root',
        'DB_PASSWORD=secret',
      ],
      configLines: [
        `    mysql2: {`,
        `      client: 'mysql2',`,
        `      connection: {`,
        `        host: env('DB_HOST', '127.0.0.1'),`,
        `        port: env('DB_PORT', 3306),`,
        `        database: env('DB_DATABASE', 'faberjs'),`,
        `        user: env('DB_USERNAME', 'root'),`,
        `        password: env('DB_PASSWORD', ''),`,
        `      },`,
        `    },`,
      ],
    };
  }

  // postgres default
  return {
    driverDep: { pg: '^8.13.0' },
    envLines: [
      'DB_CONNECTION=pg',
      'DB_HOST=127.0.0.1',
      'DB_PORT=5432',
      'DB_DATABASE=faberjs',
      'DB_USERNAME=postgres',
      'DB_PASSWORD=',
    ],
    exampleLines: [
      'DB_CONNECTION=pg',
      'DB_HOST=127.0.0.1',
      'DB_PORT=5432',
      'DB_DATABASE=faberjs',
      'DB_USERNAME=postgres',
      'DB_PASSWORD=secret',
    ],
    configLines: [
      `    pg: {`,
      `      client: 'pg',`,
      `      connection: {`,
      `        host: env('DB_HOST', '127.0.0.1'),`,
      `        port: env('DB_PORT', 5432),`,
      `        database: env('DB_DATABASE', 'faberjs'),`,
      `        user: env('DB_USERNAME', 'postgres'),`,
      `        password: env('DB_PASSWORD', ''),`,
      `      },`,
      `    },`,
    ],
  };
}

export async function scaffoldProject(opts: ScaffoldOptions): Promise<string[]> {
  const files = buildFiles(opts);
  const written: string[] = [];

  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(opts.targetDir, relativePath);
    const dir = path.dirname(fullPath);
    await mkdir(dir, { recursive: true });
    await writeFile(fullPath, content, 'utf8');
    written.push(relativePath);
  }

  // Create empty directories
  for (const dir of [
    'storage/logs',
    'storage/cache',
    'tests/Feature',
    'tests/Unit',
    'app/jobs',
    'app/events',
    'app/listeners',
    'app/policies',
    'app/commands',
  ]) {
    await mkdir(path.join(opts.targetDir, dir), { recursive: true });
  }

  return written;
}
