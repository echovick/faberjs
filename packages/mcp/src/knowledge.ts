export interface KnowledgeSection {
  title: string;
  keywords: string[];
  content: string;
}

export const knowledge: KnowledgeSection[] = [
  {
    title: 'FaberJS Overview',
    keywords: [
      'overview',
      'intro',
      'what',
      'faberjs',
      'framework',
      'laravel',
      'node',
      'typescript',
    ],
    content: `
FaberJS is a full-featured, opinionated Node.js/TypeScript backend framework that mirrors the Laravel developer experience. It targets Laravel developers moving to Node.js who want a unified framework with conventions, a CLI (faber), routing, ORM, queues, events, and DI — all in one package.

All packages are published under the @faber-js/ npm scope. The CLI binary is "faber" (Artisan equivalent). v1.0 is shipped and stable.

Core philosophy: Convention over configuration. Zero mental translation from Laravel. Route → Controller → Service → Model → Job/Event.

Tech stack: Node.js >= 20, TypeScript 5.x strict, Fastify v5 (hidden), Knex (hidden), BullMQ, JWT via jose, pnpm workspaces.

IMPORTANT: Fastify and Knex are implementation details — never import from them directly. All user code goes through @faber-js/* packages.
`.trim(),
  },

  {
    title: 'Project Structure',
    keywords: ['structure', 'directory', 'folders', 'layout', 'project', 'files'],
    content: `
Standard FaberJS project layout:

  app/
    controllers/    HTTP controllers (extend Controller)
    models/         ORM models (extend Model)
    services/       Business logic (extend Service)
    jobs/           Queue jobs (extend Job)
    events/         Event classes
    listeners/      Event listeners
    policies/       Authorization policies
    providers/      Service providers
    commands/       Custom CLI commands
  bootstrap/
    app.ts          Application bootstrap — registers providers, loads routes
  config/
    app.ts          App config
    database.ts     Database connection config
  database/
    migrations/     Migration files
    seeders/        Seeder files
  routes/
    api.ts          Route definitions
  storage/
    logs/
    cache/
  tests/
    Feature/
    Unit/
  .env              Environment variables
  faber.config.ts   Framework config (name, port)

Entry point: bootstrap/app.ts. The app boots providers, loads routes, then starts the HTTP server.
`.trim(),
  },

  {
    title: 'Routing — @faber-js/router',
    keywords: [
      'route',
      'routing',
      'router',
      'get',
      'post',
      'put',
      'delete',
      'patch',
      'group',
      'resource',
      'middleware',
      'prefix',
    ],
    content: `
Import: import { Route } from '@faber-js/router';

Basic routes:
  Route.get('/path', [Controller, 'method']);
  Route.post('/path', [Controller, 'method']);
  Route.put('/path/:id', [Controller, 'method']);
  Route.patch('/path/:id', [Controller, 'method']);
  Route.delete('/path/:id', [Controller, 'method']);

Route with inline handler:
  Route.get('/health', () => Promise.resolve(Response.json({ status: 'ok' })));

Route groups (prefix + middleware):
  Route.group({ prefix: '/api/v1', middleware: ['auth'] }, () => {
    Route.get('/users', [UserController, 'index']);
    Route.post('/users', [UserController, 'store']);
  });

Resource routes (generates index, store, show, update, destroy):
  Route.resource('posts', PostController);

Middleware-first chaining:
  Route.middleware('auth').group(() => {
    Route.get('/dashboard', [DashController, 'index']);
  });

Route parameters are accessed in controllers via req.route('paramName').

Routes are defined in routes/api.ts and loaded in bootstrap/app.ts after app.boot().
`.trim(),
  },

  {
    title: 'Controllers — @faber-js/router',
    keywords: ['controller', 'controllers', 'handler', 'json', 'response', 'request', 'inject'],
    content: `
Import: import { Controller } from '@faber-js/router';
        import type { Request } from '@faber-js/http';
        import { Response } from '@faber-js/http';
        import { Injectable } from '@faber-js/core';

Controllers extend Controller and must be decorated with @Injectable():

  @Injectable()
  export class PostController extends Controller {
    constructor(private readonly postService: PostService) {
      super();
    }

    async index(req: Request): Promise<Response> {
      const posts = await this.postService.all();
      return this.json({ data: posts });
    }

    async store(req: Request): Promise<Response> {
      const post = await this.postService.create(req.validated());
      return this.json({ data: post }, 201);
    }

    async show(req: Request): Promise<Response> {
      const post = await this.postService.find(Number(req.route('id')));
      return this.json({ data: post });
    }

    async update(req: Request): Promise<Response> {
      const post = await this.postService.update(Number(req.route('id')), req.validated());
      return this.json({ data: post });
    }

    async destroy(req: Request): Promise<Response> {
      await this.postService.delete(Number(req.route('id')));
      return this.noContent();
    }
  }

Controller helper methods:
  this.json(data, statusCode?)   — returns JSON response (default 200)
  this.noContent()               — returns 204 No Content
  this.authorize(ability, model) — throws 403 if policy denies

NEVER use @Injectable manually on services/models that extend base classes — it's automatic.
Wait — controllers DO need @Injectable() because the DI container resolves them.
`.trim(),
  },

  {
    title: 'Services — @faber-js/core',
    keywords: ['service', 'services', 'business logic', 'injectable', 'dependency injection', 'di'],
    content: `
Import: import { Injectable, Service } from '@faber-js/core';

Services extend Service and hold business logic. They are injected into controllers via constructor injection.

  @Injectable()
  export class PostService extends Service {
    async all(): Promise<Post[]> {
      return Post.all<Post>();
    }

    async find(id: number): Promise<Post | null> {
      return Post.find<Post>(id);
    }

    async create(data: Record<string, unknown>): Promise<Post> {
      const post = await Post.create<Post>(data as any);
      await event(new PostCreated(post));
      await dispatch(new NotifyFollowers(post));
      return post;
    }

    async update(id: number, data: Record<string, unknown>): Promise<Post | null> {
      const post = await Post.find<Post>(id);
      if (!post) return null;
      await post.update(data as any);
      return post;
    }

    async delete(id: number): Promise<void> {
      const post = await Post.find<Post>(id);
      if (post) await post.delete();
    }
  }

Services are auto-wired by the IoC container. No manual registration needed.
Generate: npx faber make:service PostService
`.trim(),
  },

  {
    title: 'ORM Models — @faber-js/orm',
    keywords: [
      'model',
      'models',
      'orm',
      'database',
      'query',
      'eloquent',
      'active record',
      'where',
      'find',
      'all',
      'create',
      'update',
      'delete',
    ],
    content: `
Import: import { Model } from '@faber-js/orm';

Models extend Model and map to database tables:

  export class Post extends Model {
    static table = 'posts';
    static fillable = ['title', 'body', 'author_id', 'published'];
    static hidden = [];    // fields excluded from JSON serialization

    // Relationships
    author() {
      return this.belongsTo(User, 'author_id');
    }

    comments() {
      return this.hasMany(Comment, 'post_id');
    }

    tags() {
      return this.belongsToMany(Tag, 'post_tags', 'post_id', 'tag_id');
    }

    // Query scopes — called as Post.published()
    scopePublished(query: any) {
      return query.where('published', true).orderBy('created_at', 'desc');
    }
  }

Static query methods:
  Post.all<Post>()                          — all records
  Post.find<Post>(id)                       — find by primary key (returns null if not found)
  Post.findOrFail<Post>(id)                 — find or throw 404
  Post.where('column', value)               — start a query
  Post.where('column', 'operator', value)   — with operator (>, <, >=, <=, !=, like)
  Post.orderBy('created_at', 'desc')
  Post.limit(n)
  Post.offset(n)
  Post.with('author', 'tags')               — eager load relationships
  Post.paginate(page, perPage)              — returns { data, total, page, perPage, lastPage }
  Post.count()
  Post.create<Post>(data)                   — insert and return instance

Instance methods:
  post.update({ title: 'New Title' })       — update attributes
  post.delete()                             — delete record
  post.author                               — loaded relation (after .with())

NEVER import from knex directly. All queries go through the Model API.
Generate: npx faber make:model Post -m   (creates model + migration)
`.trim(),
  },

  {
    title: 'Migrations — @faber-js/orm',
    keywords: [
      'migration',
      'migrations',
      'schema',
      'table',
      'column',
      'database schema',
      'up',
      'down',
    ],
    content: `
Import: import { Migration, Schema } from '@faber-js/orm';

Migration class:

  export default class CreatePostsTable extends Migration {
    async up(): Promise<void> {
      await Schema.create('posts', (table) => {
        table.id();                              // auto-increment primary key
        table.string('title');
        table.text('body').nullable();
        table.string('slug').unique();
        table.boolean('published').defaultTo(false);
        table.integer('author_id').unsigned();
        table.foreign('author_id').references('users.id').onDelete('cascade');
        table.decimal('price', 10, 2).nullable();
        table.json('metadata').nullable();
        table.timestamps();                       // created_at + updated_at
      });
    }

    async down(): Promise<void> {
      await Schema.dropIfExists('posts');
    }
  }

Column types:
  table.id()                    — bigIncrements primary key
  table.string(name, length?)   — VARCHAR
  table.text(name)              — TEXT
  table.integer(name)           — INT
  table.bigInteger(name)        — BIGINT
  table.boolean(name)           — BOOLEAN
  table.decimal(name, p, s)     — DECIMAL
  table.float(name)             — FLOAT
  table.json(name)              — JSON
  table.timestamp(name)         — TIMESTAMP
  table.timestamps()            — created_at + updated_at
  table.softDeletes()           — deleted_at
  table.uuid(name)              — UUID

Modifiers:
  .nullable()
  .defaultTo(value)
  .unique()
  .unsigned()
  .index()

Schema modification (alter table):
  await Schema.table('posts', (table) => {
    table.string('excerpt').nullable();
  });

CLI commands:
  npx faber db:migrate           — run pending migrations
  npx faber db:rollback          — rollback last batch
  npx faber db:status            — show migration status
  npx faber make:migration CreatePostsTable
`.trim(),
  },

  {
    title: 'Request & Response — @faber-js/http',
    keywords: [
      'request',
      'response',
      'req',
      'res',
      'body',
      'query',
      'params',
      'headers',
      'validated',
      'input',
      'all',
    ],
    content: `
Import: import type { Request } from '@faber-js/http';
        import { Response } from '@faber-js/http';

Request methods:
  req.all()                     — all body + query params merged
  req.input(key, default?)      — single value from body or query
  req.body()                    — raw request body object
  req.query(key, default?)      — query string value
  req.route(param)              — URL route parameter (e.g. :id)
  req.header(name)              — request header value
  req.validated()               — validated data (after FormRequest passes)
  req.user<UserType>()          — authenticated user (requires auth middleware)
  req.ip()                      — client IP address
  req.method()                  — HTTP method string
  req.url()                     — request URL

Response static methods:
  Response.json(data, status?)  — JSON response
  Response.redirect(url)        — redirect response
  Response.noContent()          — 204 response

In controllers, use shorthand:
  this.json(data, status?)      — same as Response.json()
  this.noContent()              — same as Response.noContent()

NEVER access req.body directly for user input in production — always use req.validated() after validation, or req.input() / req.all() for unvalidated access.
`.trim(),
  },

  {
    title: 'Queues & Jobs — @faber-js/queue',
    keywords: [
      'queue',
      'job',
      'jobs',
      'dispatch',
      'worker',
      'bullmq',
      'delay',
      'retry',
      'background',
    ],
    content: `
Import: import { dispatch } from '@faber-js/queue';
        import { Job } from '@faber-js/queue';

Dispatch a job (one-liner):
  await dispatch(new SendWelcomeEmail(user));

With options:
  await dispatch(new ProcessPayment(order))
    .onQueue('payments')
    .delay(60)         // delay in seconds
    .attempts(3)       // max retry attempts
    .backoff(30);      // backoff in seconds between retries

Job class:
  import { Job } from '@faber-js/queue';

  export class SendWelcomeEmail extends Job {
    constructor(public readonly user: User) {
      super();
    }

    async handle(): Promise<void> {
      // Send the email
      await mailer.send(this.user.email, new WelcomeMailTemplate(this.user));
    }

    // Optional: configure queue
    static queue = 'emails';
    static attempts = 3;
    static backoff = 30;
  }

Jobs are backed by BullMQ + Redis. Configure Redis in your .env:
  REDIS_HOST=127.0.0.1
  REDIS_PORT=6379

Generate: npx faber make:job SendWelcomeEmail
`.trim(),
  },

  {
    title: 'Events & Listeners — @faber-js/events',
    keywords: [
      'event',
      'events',
      'listener',
      'listeners',
      'event bus',
      'fire',
      'emit',
      'dispatch event',
    ],
    content: `
Import: import { event } from '@faber-js/events';
        import { Event } from '@faber-js/events';
        import { Listener, ListenFor } from '@faber-js/events';

Fire an event:
  await event(new UserRegistered(user));
  await event(new PostPublished(post));

Event class:
  import { Event } from '@faber-js/events';

  export class UserRegistered extends Event {
    constructor(public readonly user: User) {
      super();
    }
  }

Listener class:
  import { Listener, ListenFor } from '@faber-js/events';
  import { UserRegistered } from '../events/UserRegistered';

  @ListenFor(UserRegistered)
  export class SendWelcomeEmailListener extends Listener {
    async handle(event: UserRegistered): Promise<void> {
      await dispatch(new SendWelcomeEmail(event.user));
    }
  }

Listeners are auto-discovered from app/listeners/. No manual registration needed.

Queued listeners: extend QueuedListener instead of Listener to run the handle() in a BullMQ job.

Generate:
  npx faber make:event UserRegistered
  npx faber make:listener SendWelcomeEmailListener
`.trim(),
  },

  {
    title: 'Authentication & Policies — @faber-js/auth',
    keywords: [
      'auth',
      'authentication',
      'authorization',
      'jwt',
      'token',
      'guard',
      'policy',
      'policies',
      'login',
      'user',
      'middleware auth',
    ],
    content: `
Import: import { AuthServiceProvider } from '@faber-js/auth';
        import { Policy } from '@faber-js/auth';

Setup (bootstrap/app.ts):
  import { AuthServiceProvider } from '../app/providers/AuthServiceProvider';
  app.register(new AuthServiceProvider(app));

Configure AuthServiceProvider (app/providers/AuthServiceProvider.ts):
  export class AuthServiceProvider extends BaseAuthServiceProvider {
    protected authConfig(): AuthConfig {
      return {
        secret: process.env['JWT_SECRET'] ?? 'change-me',
        expiresIn: '7d',
      };
    }

    protected userProvider(): UserProviderContract {
      return {
        async findByCredentials(credentials) {
          return User.where('email', credentials.email).first<User>();
        },
        async findById(id) {
          return User.find<User>(Number(id));
        },
      };
    }
  }

Protect routes with 'auth' middleware:
  Route.group({ middleware: ['auth'] }, () => {
    Route.get('/profile', [UserController, 'profile']);
  });

  // Or:
  Route.middleware('auth').group(() => {
    Route.resource('posts', PostController);
  });

Access authenticated user in controller:
  const user = req.user<User>();

Authorization policies:
  export class PostPolicy extends Policy {
    async update(user: User, post: Post): Promise<boolean> {
      return post.author_id === user.id;
    }

    async delete(user: User, post: Post): Promise<boolean> {
      return post.author_id === user.id || user.role === 'admin';
    }
  }

Check policy in controller (throws 403 if denied):
  await this.authorize('update', post);

JWT token endpoint (typically in AuthController):
  const token = await req.login(credentials);  // returns JWT string
  return this.json({ token });
`.trim(),
  },

  {
    title: 'Validation — @faber-js/validation',
    keywords: [
      'validation',
      'validate',
      'rules',
      'form request',
      'formrequest',
      'required',
      'validated',
    ],
    content: `
Import: import { FormRequest } from '@faber-js/validation';

Create a FormRequest:
  export class CreatePostRequest extends FormRequest {
    rules(): Record<string, string | string[]> {
      return {
        title:   'required|string|min:3|max:255',
        body:    'required|string',
        slug:    'required|string|unique:posts,slug',
        price:   'numeric|min:0',
        tags:    'array',
        'tags.*': 'integer',
      };
    }

    messages(): Record<string, string> {
      return {
        'title.required': 'A title is required.',
        'title.min':      'Title must be at least 3 characters.',
      };
    }
  }

Use in controller (inject as constructor param):
  @Injectable()
  export class PostController extends Controller {
    constructor(
      private readonly request: CreatePostRequest,
      private readonly posts: PostService,
    ) { super(); }

    async store(req: Request): Promise<Response> {
      const data = req.validated();   // throws 422 if validation fails
      const post = await this.posts.create(data);
      return this.json({ data: post }, 201);
    }
  }

Available rules:
  required, string, integer, numeric, boolean, array, email
  min:n, max:n, between:n,m
  in:a,b,c, not_in:a,b,c
  unique:table,column, exists:table,column
  confirmed (checks field_confirmation)
  url, ip, uuid
  nullable (allows null/empty)
  sometimes (only validate if present)

Validation failure automatically returns HTTP 422 with errors JSON:
  { "errors": { "title": ["A title is required."] } }

Generate: npx faber make:validation CreatePostRequest
`.trim(),
  },

  {
    title: 'Configuration — @faber-js/config',
    keywords: ['config', 'configuration', 'env', 'environment', '.env', 'settings'],
    content: `
Import: import { env } from '@faber-js/config';

Read environment variables with type coercion:
  const port = env('APP_PORT', 3000);          // returns number if default is number
  const name = env('APP_NAME', 'faberjs');      // returns string
  const debug = env('APP_DEBUG', false);        // returns boolean

Config files live in config/:
  config/app.ts:
    import { env } from '@faber-js/config';
    export default {
      name: env('APP_NAME', 'faberjs'),
      port: env('APP_PORT', 3000),
      debug: env('APP_DEBUG', false),
    };

  config/database.ts — database connection config (generated by scaffolder)

.env variables for a typical app:
  APP_NAME=my-app
  APP_PORT=3000
  DB_CONNECTION=better-sqlite3  (or pg, mysql2)
  DB_DATABASE=./storage/database.sqlite
  JWT_SECRET=change-me-in-production
  REDIS_HOST=127.0.0.1
  REDIS_PORT=6379
`.trim(),
  },

  {
    title: 'Bootstrap & Service Providers — @faber-js/core',
    keywords: [
      'bootstrap',
      'app',
      'application',
      'provider',
      'service provider',
      'register',
      'boot',
      'container',
      'ioc',
    ],
    content: `
bootstrap/app.ts — the application entry point:

  import 'reflect-metadata';
  import { Application } from '@faber-js/core';
  import { HttpServiceProvider, HttpKernel } from '@faber-js/http';
  import { RouterServiceProvider } from '@faber-js/router';
  import { OrmServiceProvider } from '@faber-js/orm';

  void (async () => {
    const app = new Application();

    app.register(new HttpServiceProvider(app));
    app.register(new RouterServiceProvider(app));
    app.register(new OrmServiceProvider(app));

    await app.boot();

    require('../routes/api');  // load routes after boot

    const kernel = app.make<HttpKernel>('http.kernel');
    await kernel.listen(Number(process.env['APP_PORT'] ?? 3000));
  })();

Custom service provider:
  import { ServiceProvider } from '@faber-js/core';

  export class AppServiceProvider extends ServiceProvider {
    register(): void {
      // bind things into the container
      this.app.bind('my-service', () => new MyService());
    }

    async boot(): Promise<void> {
      // runs after all providers are registered
    }
  }

IMPORTANT: reflect-metadata must be the very first import in bootstrap/app.ts.
The app uses ts-node, not tsx/esbuild, because emitDecoratorMetadata requires ts-node.
`.trim(),
  },

  {
    title: 'AI Agents — @faber-js/ai',
    keywords: ['ai', 'agent', 'agents', 'claude', 'anthropic', 'tool', 'chat', 'stream', 'llm'],
    content: `
Import: import { Agent, Tool } from '@faber-js/ai';
        import { Injectable } from '@faber-js/core';

Create an AI agent:
  @Injectable()
  export class SupportAgent extends Agent {
    protected model = 'claude-sonnet-4-6';
    protected maxTokens = 4096;
    protected systemPrompt = 'You are a helpful support agent for our platform.';

    @Tool({ description: 'Look up a user by their email address' })
    async lookupUser(input: { email: string }): Promise<string> {
      const user = await User.where('email', input.email).first<User>();
      return user ? JSON.stringify(user) : 'User not found';
    }

    @Tool({
      description: 'Create a support ticket',
      inputSchema: {
        type: 'object',
        properties: {
          subject: { type: 'string', description: 'Ticket subject' },
          body:    { type: 'string', description: 'Ticket body' },
        },
        required: ['subject', 'body'],
      },
    })
    async createTicket(input: { subject: string; body: string }): Promise<string> {
      const ticket = await Ticket.create(input);
      return \`Ticket #\${ticket.id} created\`;
    }
  }

Use in a controller:
  @Injectable()
  export class SupportController extends Controller {
    constructor(private agent: SupportAgent) { super(); }

    async chat(req: Request): Promise<Response> {
      const reply = await this.agent.chat(req.input('message'));
      return this.json({ reply });
    }

    async stream(req: Request): Promise<Response> {
      // Returns an async generator of string chunks
      const stream = this.agent.stream(req.input('message'));
      // ... handle streaming response
    }
  }

Default model: claude-sonnet-4-6 (can be overridden per-agent).
Tools are auto-discovered via @Tool() decorator + reflect-metadata.
Generate: npx faber make:agent SupportAgent
`.trim(),
  },

  {
    title: 'CLI Commands — @faber-js/console',
    keywords: ['cli', 'command', 'commands', 'faber', 'make', 'generate', 'artisan', 'console'],
    content: `
All CLI commands use colon-separated style matching Laravel Artisan.

Code generation:
  npx faber make:controller PostController
  npx faber make:model Post -m          (-m creates migration too)
  npx faber make:service PostService
  npx faber make:job NotifyFollowers
  npx faber make:event UserRegistered
  npx faber make:listener SendWelcomeEmail
  npx faber make:middleware RateLimitMiddleware
  npx faber make:migration CreatePostsTable
  npx faber make:provider AppServiceProvider
  npx faber make:command SyncDataCommand
  npx faber make:agent SupportAgent
  npx faber make:validation CreatePostRequest

Database:
  npx faber db:migrate          — run all pending migrations
  npx faber db:rollback         — rollback last batch
  npx faber db:seed             — run seeders
  npx faber db:status           — show migration status

Development:
  npx faber serve               — start dev server with hot reload
  npx faber tinker              — interactive REPL with app context
  npx faber route:list          — list all registered routes

Custom commands (app/commands/):
  import { Command } from '@faber-js/console';

  export class SyncDataCommand extends Command {
    static signature = 'sync:data';
    static description = 'Sync external data';

    async handle(): Promise<void> {
      this.info('Syncing data...');
      // do work
      this.success('Done!');
    }
  }
`.trim(),
  },

  {
    title: 'Common Patterns & Anti-Patterns',
    keywords: [
      'pattern',
      'patterns',
      'anti-pattern',
      'best practice',
      'common',
      'mistake',
      'wrong',
      'correct',
    ],
    content: `
CORRECT patterns:

1. Always use constructor injection — never instantiate services manually:
   // CORRECT
   constructor(private readonly postService: PostService) { super(); }
   // WRONG
   const service = new PostService();  // never do this

2. Use req.validated() for safe input — not req.body() or req.all() in production:
   const data = req.validated();

3. Route params via req.route(), query via req.query(), body via req.input():
   const id = Number(req.route('id'));
   const page = req.query('page', 1);
   const title = req.input('title');

4. Always return Response from controllers:
   return this.json({ data: post });
   return this.noContent();

5. Events and jobs via global helpers — never dispatch manually:
   await event(new UserRegistered(user));
   await dispatch(new SendWelcomeEmail(user));

6. Static table name on models:
   static table = 'posts';

7. Use .with() for eager loading to avoid N+1:
   Post.with('author', 'comments').all<Post>()

ANTI-PATTERNS to avoid:

- Never import from 'fastify' directly
- Never import from 'knex' directly
- Never write @Injectable() on classes that extend Service or Model — only on Controllers
- Never use req.body directly in route handlers without validation
- Never skip reflect-metadata import in bootstrap/app.ts
- Never use ESM imports in app code — FaberJS apps use CommonJS + ts-node
`.trim(),
  },
];

export function searchKnowledge(query: string): KnowledgeSection[] {
  const q = query.toLowerCase().trim();
  if (!q) return knowledge;

  const scored = knowledge.map((section) => {
    let score = 0;
    if (section.title.toLowerCase().includes(q)) score += 10;
    if (section.keywords.some((k) => q.includes(k) || k.includes(q))) score += 5;
    if (section.content.toLowerCase().includes(q)) score += 2;
    return { section, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.section);
}
