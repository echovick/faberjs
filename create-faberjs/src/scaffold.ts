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
          migrate: 'faber db:migrate',
          'migrate:rollback': 'faber db:rollback',
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
          '@faber-js/console': '^1.0.12',
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

    // ── AI coding agent context files ──────────────────────────

    'CLAUDE.md': buildClaudeMd(projectName),

    '.cursorrules': buildCursorRules(),

    '.github/copilot-instructions.md': buildCopilotInstructions(),

    '.mcp.json': JSON.stringify(
      {
        mcpServers: {
          faberjs: {
            command: 'npx',
            args: ['-y', '@faber-js/mcp'],
          },
        },
      },
      null,
      2,
    ),

    // ── Claude Code skills ─────────────────────────────────────

    '.claude/commands/make.md': [
      `Generate a FaberJS file using the faber CLI.`,
      ``,
      `Usage: /make <type> <Name>`,
      ``,
      `Examples:`,
      `  /make controller PostController`,
      `  /make model Post -m`,
      `  /make service PostService`,
      `  /make job SendWelcomeEmail`,
      `  /make event UserRegistered`,
      `  /make listener SendWelcomeEmailListener`,
      `  /make migration CreatePostsTable`,
      ``,
      `Run the appropriate \`npx faber make:<type> <Name>\` command based on the user's request.`,
      `For model with -m flag, run \`npx faber make:model <Name> -m\`.`,
      `After running, show the user which files were created.`,
    ].join('\n'),

    '.claude/commands/migrate.md': [
      `Run FaberJS database migrations.`,
      ``,
      `Run: npx faber db:migrate`,
      ``,
      `Show the output. If the migration fails, read the failing migration file`,
      `and explain what went wrong and how to fix it.`,
    ].join('\n'),

    '.claude/commands/rollback.md': [
      `Rollback the last batch of FaberJS database migrations.`,
      ``,
      `Before running, confirm with the user that they want to rollback.`,
      `Then run: npx faber db:rollback`,
      ``,
      `Show the output and list which migrations were rolled back.`,
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

function buildClaudeMd(projectName: string): string {
  return `# ${projectName} — FaberJS Project

FaberJS is a full-featured, opinionated Node.js/TypeScript backend framework that mirrors the Laravel developer experience. This project was scaffolded with \`create-faberjs\`.

## MCP Integration

This project ships with \`.mcp.json\` — Claude Code will auto-connect the \`@faber-js/mcp\` server, giving you tools to generate files, run migrations, and search docs directly from the agent.

Available MCP tools:
- \`faber_docs\` — search framework API docs
- \`faber_make\` — generate controllers, models, services, jobs, etc.
- \`faber_migrate\` / \`faber_rollback\` / \`faber_db_status\` — database
- \`faber_route_list\` — list all registered routes

## Project Structure

\`\`\`
app/
  controllers/   HTTP controllers — extend Controller, decorate @Injectable()
  models/        ORM models — extend Model, define static table + fillable
  services/      Business logic — extend Service, decorate @Injectable()
  jobs/          Queue jobs — extend Job, implement handle()
  events/        Event classes — extend Event
  listeners/     Event listeners — extend Listener, decorate @ListenFor()
  policies/      Auth policies — extend Policy
  providers/     Service providers — extend ServiceProvider
  commands/      Custom CLI commands — extend Command
bootstrap/app.ts Application entry — registers providers, loads routes
config/          Typed config files
database/migrations/ Migration files
routes/api.ts    Route definitions
\`\`\`

## Core Flow

Route → Controller → Service → Model → Job/Event

## Package APIs

### Routing (@faber-js/router)

\`\`\`typescript
import { Route } from '@faber-js/router';

Route.get('/posts', [PostController, 'index']);
Route.post('/posts', [PostController, 'store']);
Route.get('/posts/:id', [PostController, 'show']);
Route.put('/posts/:id', [PostController, 'update']);
Route.delete('/posts/:id', [PostController, 'destroy']);

Route.group({ prefix: '/api/v1', middleware: ['auth'] }, () => {
  Route.resource('posts', PostController);
});
\`\`\`

### Controllers (@faber-js/router)

\`\`\`typescript
import { Injectable } from '@faber-js/core';
import { Controller } from '@faber-js/router';
import type { Request } from '@faber-js/http';
import { Response } from '@faber-js/http';

@Injectable()
export class PostController extends Controller {
  constructor(private readonly posts: PostService) { super(); }

  async index(_req: Request): Promise<Response> {
    return this.json({ data: await this.posts.all() });
  }

  async store(req: Request): Promise<Response> {
    const post = await this.posts.create(req.validated());
    return this.json({ data: post }, 201);
  }

  async show(req: Request): Promise<Response> {
    return this.json({ data: await this.posts.find(Number(req.route('id'))) });
  }

  async destroy(req: Request): Promise<Response> {
    await this.posts.delete(Number(req.route('id')));
    return this.noContent();
  }
}
\`\`\`

Request methods: \`req.route(param)\`, \`req.query(key, default?)\`, \`req.input(key)\`, \`req.all()\`, \`req.validated()\`, \`req.user<T>()\`

### ORM Models (@faber-js/orm)

\`\`\`typescript
import { Model } from '@faber-js/orm';

export class Post extends Model {
  static table = 'posts';
  static fillable = ['title', 'body', 'author_id'];

  author() { return this.belongsTo(User, 'author_id'); }
  comments() { return this.hasMany(Comment, 'post_id'); }

  scopePublished(query: any) {
    return query.where('published', true).orderBy('created_at', 'desc');
  }
}

// Queries
await Post.all<Post>();
await Post.find<Post>(id);
await Post.where('published', true).with('author', 'tags').paginate(1, 15);
await Post.create<Post>(data);
await post.update({ title: 'New' });
await post.delete();
\`\`\`

### Queues & Jobs (@faber-js/queue)

\`\`\`typescript
import { dispatch } from '@faber-js/queue';
import { Job } from '@faber-js/queue';

// Dispatch
await dispatch(new SendWelcomeEmail(user));
await dispatch(new ProcessPayment(order)).onQueue('payments').delay(60);

// Job class
export class SendWelcomeEmail extends Job {
  constructor(public readonly user: User) { super(); }
  async handle(): Promise<void> { /* ... */ }
}
\`\`\`

### Events & Listeners (@faber-js/events)

\`\`\`typescript
import { event } from '@faber-js/events';
import { Event, Listener, ListenFor } from '@faber-js/events';

await event(new UserRegistered(user));

export class UserRegistered extends Event {
  constructor(public readonly user: User) { super(); }
}

@ListenFor(UserRegistered)
export class SendWelcomeEmailListener extends Listener {
  async handle(e: UserRegistered): Promise<void> {
    await dispatch(new SendWelcomeEmail(e.user));
  }
}
\`\`\`

### Auth (@faber-js/auth)

\`\`\`typescript
Route.group({ middleware: ['auth'] }, () => { /* protected routes */ });
const user = req.user<User>();
await this.authorize('update', post);  // throws 403 if denied
\`\`\`

### Validation (@faber-js/validation)

\`\`\`typescript
export class CreatePostRequest extends FormRequest {
  rules() {
    return { title: 'required|string|min:3', body: 'required|string' };
  }
}
// In controller: const data = req.validated();  — auto 422 on failure
\`\`\`

## CLI Commands

\`\`\`bash
npx faber make:controller PostController
npx faber make:model Post -m          # -m creates migration too
npx faber make:service PostService
npx faber make:job SendWelcomeEmail
npx faber make:event UserRegistered
npx faber make:listener SendWelcomeEmailListener
npx faber make:migration CreatePostsTable
npx faber db:migrate
npx faber db:rollback
npx faber serve
npx faber route:list
\`\`\`

## Anti-Patterns

- NEVER import from \`fastify\` or \`knex\` directly
- NEVER instantiate services with \`new\` — use constructor injection
- NEVER skip \`reflect-metadata\` import in bootstrap/app.ts
- NEVER use \`req.body\` directly — use \`req.validated()\` or \`req.input()\`
- NEVER write \`@Injectable()\` on Model or Service subclasses — only on Controllers
`;
}

function buildCursorRules(): string {
  return `# FaberJS Cursor Rules

You are working in a FaberJS project — a Laravel-inspired Node.js/TypeScript backend framework.

## Core Rules

- Framework flow: Route → Controller → Service → Model → Job/Event
- Never import from fastify or knex — all code uses @faber-js/* packages
- Never instantiate services manually — always use constructor injection
- Controllers extend Controller and need @Injectable()
- Services extend Service and need @Injectable()
- Models extend Model — no decorator needed
- Jobs extend Job, implement async handle()
- Events extend Event, Listeners extend Listener with @ListenFor(EventClass)

## Key APIs

Routing: Route.get/post/put/patch/delete(path, [Controller, 'method'])
Groups: Route.group({ prefix, middleware }, () => { ... })
Request: req.route(param), req.query(key), req.input(key), req.validated(), req.user<T>()
Response: this.json(data, status?), this.noContent()
ORM: Model.all(), Model.find(id), Model.where(col, val).with(rel).paginate(page, per)
Dispatch: await dispatch(new MyJob(data))
Events: await event(new MyEvent(data))
Auth: Route.middleware('auth').group(...), req.user<T>(), this.authorize('ability', model)
Validation: class MyRequest extends FormRequest { rules() { return { field: 'required|string' } } }

## CLI

npx faber make:controller|model|service|job|event|listener|migration|provider|command|agent
npx faber db:migrate | db:rollback | db:status
npx faber serve | route:list | tinker

## File Locations

Controllers: app/controllers/
Models: app/models/
Services: app/services/
Jobs: app/jobs/
Events: app/events/
Listeners: app/listeners/
Migrations: database/migrations/
Routes: routes/api.ts
Bootstrap: bootstrap/app.ts
`;
}

function buildCopilotInstructions(): string {
  return `# FaberJS Copilot Instructions

This is a FaberJS project — a Laravel-inspired Node.js/TypeScript backend framework.

## Framework Conventions

- All packages are under @faber-js/* — never import from fastify or knex directly
- Framework flow: Route → Controller → Service → Model → Job/Event
- Controllers: extend Controller, decorate @Injectable(), inject services via constructor
- Services: extend Service, decorate @Injectable(), contain business logic
- Models: extend Model, define static table and fillable, use ActiveRecord methods
- Jobs: extend Job, implement async handle(), dispatched with dispatch(new MyJob())
- Events: extend Event, fired with event(new MyEvent()), handled by Listener subclasses
- Listeners: extend Listener, decorated @ListenFor(EventClass), auto-discovered

## Key Code Patterns

\`\`\`typescript
// Route definition
Route.group({ prefix: '/api', middleware: ['auth'] }, () => {
  Route.resource('posts', PostController);
});

// Controller
@Injectable()
export class PostController extends Controller {
  constructor(private posts: PostService) { super(); }
  async index(_req: Request): Promise<Response> {
    return this.json({ data: await this.posts.all() });
  }
}

// ORM query
const posts = await Post.where('published', true).with('author').paginate(1, 15);

// Job dispatch
await dispatch(new SendWelcomeEmail(user));

// Event
await event(new UserRegistered(user));
\`\`\`

## CLI
npx faber make:controller|model|service|job|event|listener|migration
npx faber db:migrate | db:rollback | serve | route:list
`;
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
