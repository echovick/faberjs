# PRD: ForgeJS — A Laravel-Inspired Node.js Framework

**Version:** 1.0.0  
**Status:** Ready for Engineering  
**Author:** [Your Name]  
**Last Updated:** 2026-04-26

---

## 1. Overview

### 1.1 Vision
ForgeJS is a full-featured, opinionated Node.js/TypeScript backend framework that mirrors Laravel's developer experience — conventions, architecture, CLI, and ecosystem — without compromising the JavaScript runtime's native strengths.

### 1.2 Problem Statement
Laravel developers switching to JavaScript face a fragmented ecosystem: Express for routing, Prisma or Sequelize for ORM, BullMQ for queues, custom DI containers — all with no unifying conventions, no CLI, and no cohesive request lifecycle. The result is decision fatigue, boilerplate overload, and inconsistent project structures.

### 1.3 Target Users
- Senior PHP/Laravel developers transitioning to Node.js
- JS developers who want opinionated, structured frameworks
- Teams building REST APIs or full-stack JS apps that need fast scaffolding

### 1.4 Success Metrics
- A fresh project compiles, runs, and serves an API route in under 2 minutes after `npm create forgejs@latest`
- Core DX parity with Laravel for: routing, ORM, middleware, DI container, CLI, migrations, queues, events
- All core packages are independently publishable to npm

---

## 2. Framework Name & Branding

| Item | Value |
|---|---|
| Framework Name | **ForgeJS** |
| CLI Binary | `forge` |
| npm Scope | `@forgejs/` |
| Config File | `forge.config.ts` |
| Entry Point | `bootstrap/app.ts` |

---

## 3. Core Architecture

### 3.1 Monorepo Structure

```
forgejs/
├── packages/
│   ├── core/              # App kernel, service container, lifecycle
│   ├── router/            # HTTP routing engine
│   ├── orm/               # Eloquent-like ActiveRecord ORM
│   ├── http/              # Request/Response, middleware pipeline
│   ├── console/           # Forge CLI (artisan equivalent)
│   ├── queue/             # Job dispatching & queue workers
│   ├── events/            # Event/Listener system
│   ├── auth/              # Authentication scaffolding
│   ├── config/            # Env + config management
│   ├── validation/        # Request validation
│   ├── cache/             # Cache abstraction (Redis, Memory)
│   └── testing/           # Test helpers & HTTP test client
├── create-forgejs/        # Project scaffolding CLI (npm create)
├── stubs/                 # Code generation templates
├── docs/
└── examples/
    ├── api-only/
    └── full-stack/
```

### 3.2 Application Bootstrap Lifecycle

The following lifecycle must be implemented in order:

```
1. Load .env → Config repository
2. Instantiate Application (IoC Container)
3. Register Core Service Providers
4. Register User Service Providers (boot phase)
5. Build HTTP Kernel → Middleware Stack
6. Start HTTP Server (fastify or native http)
7. Listen for requests → Route → Controller → Response
```

---

## 4. Package Specifications

---

### Package 1: `@forgejs/core`

**Responsibility:** Application container, service providers, facades, lifecycle management.

#### 4.1.1 Service Container (IoC)

Must support:
- `app.bind(abstract, factory)` — register a factory
- `app.singleton(abstract, factory)` — register once, reuse instance
- `app.instance(abstract, instance)` — register a pre-built instance
- `app.make(abstract)` — resolve a binding
- `app.call(fn, params)` — resolve and inject a function's dependencies
- Auto-injection via TypeScript `reflect-metadata` decorators (`@Injectable`, `@Inject`)

```typescript
// Target API
app.singleton('db', () => new Database(config('database')));
const db = app.make<Database>('db');

// Class-based DI
@Injectable()
class UserService {
  constructor(private db: Database) {}
}
const svc = app.make(UserService); // auto-resolves Database
```

#### 4.1.2 Service Providers

Every core subsystem and user feature registers via a Service Provider.

```typescript
abstract class ServiceProvider {
  abstract register(): void;  // bind into container (no side effects)
  boot(): void {}              // use bindings, set up listeners, etc.
}

// Example
class DatabaseServiceProvider extends ServiceProvider {
  register() {
    this.app.singleton('db', () => new Database(this.app.make('config').get('database')));
  }
  boot() {
    // hook up query logging, etc.
  }
}
```

#### 4.1.3 Facades

Proxy-based static wrappers around IoC-resolved instances. Allow ergonomic access like `DB.table('users').get()` without direct imports.

```typescript
// Usage
import { DB, Cache, Event } from '@forgejs/facades';
const users = await DB.table('users').where('active', true).get();

// Implementation: Facade base resolves the underlying binding from the container
```

---

### Package 2: `@forgejs/router`

**Responsibility:** HTTP routing, controller dispatch, route model binding, named routes, resource routes.

#### 4.2.1 Route Registration

```typescript
// routes/api.ts
import { Router } from '@forgejs/router';
const router = Router.group({ prefix: '/api/v1', middleware: ['auth'] }, () => {
  router.get('/users', [UserController, 'index']);
  router.post('/users', [UserController, 'store']);
  router.get('/users/:id', [UserController, 'show']);
  router.put('/users/:id', [UserController, 'update']);
  router.delete('/users/:id', [UserController, 'destroy']);

  // Shorthand: resource routes
  router.resource('posts', PostController);
});
```

#### 4.2.2 Route Model Binding

```typescript
// Automatic: param name matches model name
router.get('/users/:user', [UserController, 'show']);
// ForgeJS resolves User.find(params.user) and injects the model instance
```

#### 4.2.3 Named Routes & URL Generation

```typescript
router.get('/users/:id', [UserController, 'show']).name('users.show');

// In controllers/views
route('users.show', { id: 1 }) // → '/users/1'
```

#### 4.2.4 Controller Base Class

```typescript
abstract class Controller {
  protected validate(request: Request, rules: ValidationRules): ValidatedData;
  protected json(data: any, status = 200): Response;
  protected paginate(query: QueryBuilder): PaginatedResponse;
  protected redirect(url: string, status = 302): Response;
}
```

---

### Package 3: `@forgejs/orm`

**Responsibility:** ActiveRecord ORM inspired by Eloquent. Models represent database tables. Chainable query builder. Relationships. Migrations.

#### 4.3.1 Model Definition

```typescript
import { Model } from '@forgejs/orm';

class User extends Model {
  static table = 'users';
  static fillable = ['name', 'email'];
  static hidden = ['password'];

  // Relationships
  posts() { return this.hasMany(Post); }
  profile() { return this.hasOne(Profile); }
  roles() { return this.belongsToMany(Role, 'user_roles'); }

  // Accessors
  get fullName() { return `${this.first_name} ${this.last_name}`; }

  // Mutators
  set password(value: string) { this.attributes.password = bcrypt(value); }
}
```

#### 4.3.2 Query Builder

```typescript
// Fluent, chainable query building
const users = await User
  .where('active', true)
  .where('age', '>', 18)
  .orWhere('role', 'admin')
  .with('posts', 'profile')        // eager load relationships
  .orderBy('created_at', 'desc')
  .paginate(15);                   // page from request

// Aggregates
const count = await User.where('active', true).count();
const avg = await Order.avg('total');
```

#### 4.3.3 Model CRUD

```typescript
// Create
const user = await User.create({ name: 'Aisha', email: 'aisha@example.com' });

// Read
const user = await User.find(1);
const user = await User.where('email', 'aisha@example.com').firstOrFail();

// Update
await user.update({ name: 'Aisha Bello' });
await User.where('active', false).update({ deleted_at: new Date() });

// Delete
await user.delete();
await User.where('created_at', '<', thirtyDaysAgo).delete();

// Soft Deletes (mixin)
class Post extends Model {
  static softDeletes = true;
}
await post.delete();              // sets deleted_at
await Post.withTrashed().get();   // includes soft-deleted
await post.restore();
```

#### 4.3.4 Migrations

```typescript
// database/migrations/2026_04_26_create_users_table.ts
import { Migration, Schema } from '@forgejs/orm';

export default class CreateUsersTable extends Migration {
  async up() {
    await Schema.create('users', (table) => {
      table.id();
      table.string('name');
      table.string('email').unique();
      table.string('password');
      table.timestamps();       // created_at, updated_at
      table.softDeletes();      // deleted_at
    });
  }

  async down() {
    await Schema.dropIfExists('users');
  }
}
```

#### 4.3.5 Seeders & Factories

```typescript
// database/factories/UserFactory.ts
import { Factory } from '@forgejs/orm';
import { faker } from '@faker-js/faker';

class UserFactory extends Factory {
  model = User;
  definition() {
    return {
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: 'hashed_password',
    };
  }
}

// Usage
await UserFactory.count(50).create();
await UserFactory.state({ role: 'admin' }).count(5).create();
```

#### 4.3.6 Supported Databases

- PostgreSQL (primary, via `pg`)
- MySQL / MariaDB (via `mysql2`)
- SQLite (for testing, via `better-sqlite3`)

---

### Package 4: `@forgejs/http`

**Responsibility:** Request/Response abstraction, middleware pipeline, global exception handler.

#### 4.4.1 Middleware

```typescript
// Middleware interface
interface Middleware {
  handle(request: Request, next: NextFunction): Promise<Response>;
}

// Example
class AuthMiddleware implements Middleware {
  async handle(request: Request, next: NextFunction) {
    if (!request.bearerToken()) throw new UnauthorizedException();
    request.user = await Auth.user(request);
    return next(request);
  }
}

// Global middleware registered in bootstrap/app.ts
// Route-level middleware registered per route or group
```

#### 4.4.2 Request Object

```typescript
class Request {
  // Input
  input(key: string, fallback?: any): any;
  all(): Record<string, any>;
  only(...keys: string[]): Record<string, any>;
  except(...keys: string[]): Record<string, any>;
  has(key: string): boolean;
  filled(key: string): boolean;

  // Auth
  user(): AuthUser | null;
  bearerToken(): string | null;

  // Files
  file(key: string): UploadedFile;

  // Helpers
  isJson(): boolean;
  wantsJson(): boolean;
  ip(): string;
  header(key: string): string;
  route(param: string): string;   // route params
}
```

#### 4.4.3 Response Helpers

```typescript
// In controllers
return response().json({ data: users });
return response().json({ data: user }, 201);
return response().noContent();
return response().notFound('User not found');
return response().error('Unauthorized', 401);

// Pagination response shape (matches Laravel's)
{
  data: [...],
  meta: { current_page, last_page, per_page, total },
  links: { first, last, prev, next }
}
```

#### 4.4.4 Exception Handling

Global exception handler converts exceptions to HTTP responses:

| Exception Class | HTTP Status |
|---|---|
| `NotFoundException` | 404 |
| `UnauthorizedException` | 401 |
| `ForbiddenException` | 403 |
| `ValidationException` | 422 |
| `ModelNotFoundException` | 404 |
| Unhandled `Error` | 500 |

---

### Package 5: `@forgejs/console` (The Forge CLI)

**Responsibility:** Artisan equivalent. Code generation, migration runner, queue worker, REPL, app commands.

#### 4.5.1 Built-in Commands

```bash
# Project
forge serve                          # Start dev server (with hot reload)
forge serve --port=3333

# Code Generation (make:*)
forge make:controller UserController
forge make:controller UserController --resource  # CRUD stubs
forge make:model User
forge make:model User --migration    # model + migration together
forge make:migration create_posts_table
forge make:middleware AuthMiddleware
forge make:job SendWelcomeEmail
forge make:event UserRegistered
forge make:listener SendWelcomeEmail --event=UserRegistered
forge make:seeder UserSeeder
forge make:factory UserFactory
forge make:command SendDailyReport
forge make:provider PaymentServiceProvider

# Database
forge db:migrate
forge db:migrate --fresh             # drop all + re-migrate
forge db:migrate --fresh --seed      # + run seeders
forge db:rollback
forge db:rollback --step=3
forge db:seed
forge db:seed --class=UserSeeder
forge db:status                      # show migration status table

# Queue
forge queue:work
forge queue:work --queue=emails,notifications
forge queue:failed                   # list failed jobs
forge queue:retry all

# App
forge tinker                         # REPL with app context injected
forge route:list                     # print all registered routes
forge config:show                    # dump resolved config
forge env                            # show loaded env values
```

#### 4.5.2 Custom Commands

```typescript
// app/commands/SendDailyReport.ts
import { Command } from '@forgejs/console';

export default class SendDailyReport extends Command {
  signature = 'report:daily {--type=summary : Report type}';
  description = 'Send the daily report email to all admins';

  async handle() {
    const type = this.option('type');
    this.info(`Sending ${type} report...`);
    await ReportService.send(type);
    this.success('Done!');
  }
}
```

---

### Package 6: `@forgejs/queue`

**Responsibility:** Background job dispatching, queue workers, retry logic, failed job tracking. Backed by BullMQ + Redis.

#### 4.6.1 Defining Jobs

```typescript
import { Job } from '@forgejs/queue';

class SendWelcomeEmail extends Job {
  queue = 'emails';
  tries = 3;
  backoff = [60, 300, 600]; // seconds between retries

  constructor(private user: User) {}

  async handle(mailer: Mailer) { // auto-injected from container
    await mailer.to(this.user.email).send(new WelcomeEmail(this.user));
  }

  async failed(error: Error) {
    Log.error(`Welcome email failed for ${this.user.id}`, error);
  }
}
```

#### 4.6.2 Dispatching Jobs

```typescript
// Dispatch immediately
await SendWelcomeEmail.dispatch(user);

// Delay
await SendWelcomeEmail.dispatch(user).delay(60); // seconds

// Chain
await Job.chain([
  new ProcessPayment(order),
  new SendReceipt(order),
  new NotifyWarehouse(order),
]).dispatch();

// Batch
await Job.batch(users.map(u => new SendWelcomeEmail(u))).dispatch();
```

---

### Package 7: `@forgejs/events`

**Responsibility:** Application-level event/listener bus with auto-discovery.

#### 4.7.1 Defining Events & Listeners

```typescript
// Events are plain classes
class UserRegistered {
  constructor(public user: User) {}
}

// Listeners handle events
class SendWelcomeEmail {
  async handle(event: UserRegistered) {
    await Mailer.to(event.user.email).send(new WelcomeEmail(event.user));
  }
}

// Async listeners run in the queue
class SyncAnalytics {
  queue = 'analytics'; // marks as queued listener
  async handle(event: UserRegistered) { ... }
}
```

#### 4.7.2 Registering & Firing

```typescript
// EventServiceProvider.ts
protected listen = {
  UserRegistered: [SendWelcomeEmail, SyncAnalytics],
  OrderPlaced: [ChargePayment, SendOrderConfirmation],
};

// Fire events anywhere
await Event.dispatch(new UserRegistered(user));
```

---

### Package 8: `@forgejs/validation`

**Responsibility:** Request validation with fluent rules, auto-error responses.

```typescript
// In controllers
const data = await this.validate(request, {
  name:     'required|string|min:2|max:100',
  email:    'required|email|unique:users',
  password: 'required|min:8|confirmed',
  role:     'in:admin,editor,viewer',
});

// Or as a FormRequest class (validated before controller is called)
class CreateUserRequest extends FormRequest {
  rules() {
    return {
      name:     'required|string',
      email:    ['required', 'email', Rule.unique('users').ignore(this.param('id'))],
    };
  }
  authorize() { return this.user().can('create-users'); }
}
```

Validation failure automatically returns a `422` JSON response with the error bag:
```json
{
  "message": "The given data was invalid.",
  "errors": {
    "email": ["The email has already been taken."],
    "password": ["The password must be at least 8 characters."]
  }
}
```

---

### Package 9: `@forgejs/config`

**Responsibility:** Typed config loading from `.env` and `config/*.ts` files.

```
config/
├── app.ts
├── database.ts
├── queue.ts
├── cache.ts
├── mail.ts
└── auth.ts
```

```typescript
// config/database.ts
export default {
  default: env('DB_CONNECTION', 'postgres'),
  connections: {
    postgres: {
      host: env('DB_HOST', 'localhost'),
      port: env('DB_PORT', 5432),
      database: env('DB_DATABASE'),
      username: env('DB_USERNAME'),
      password: env('DB_PASSWORD'),
    }
  }
};

// Usage anywhere
import { config } from '@forgejs/config';
config('database.connections.postgres.host');
```

---

### Package 10: `@forgejs/auth`

**Responsibility:** JWT-based authentication guards and authorization policies.

```typescript
// Guards
Auth.guard('api').attempt({ email, password });  // returns token or null
Auth.user();                                       // current authenticated user
Auth.check();                                      // boolean

// Policies
class PostPolicy {
  update(user: User, post: Post) {
    return user.id === post.user_id;
  }
}

// Usage in controllers
this.authorize('update', post); // throws ForbiddenException if not allowed
```

---

## 5. Project Structure (Generated App)

When a user runs `npm create forgejs@latest my-app`, the following structure is scaffolded:

```
my-app/
├── app/
│   ├── controllers/
│   │   └── UserController.ts
│   ├── models/
│   │   └── User.ts
│   ├── middleware/
│   │   └── AuthMiddleware.ts
│   ├── jobs/
│   ├── events/
│   ├── listeners/
│   ├── policies/
│   ├── providers/
│   │   ├── AppServiceProvider.ts
│   │   └── EventServiceProvider.ts
│   └── commands/
├── bootstrap/
│   └── app.ts               # Kernel bootstrap — register providers, middleware
├── config/
│   ├── app.ts
│   ├── database.ts
│   ├── queue.ts
│   └── auth.ts
├── database/
│   ├── migrations/
│   ├── seeders/
│   └── factories/
├── routes/
│   ├── api.ts
│   └── web.ts
├── tests/
│   ├── Feature/
│   └── Unit/
├── .env
├── .env.example
├── forge.config.ts
├── package.json
└── tsconfig.json
```

---

## 6. Testing Utilities (`@forgejs/testing`)

Laravel's testing DX is one of its strongest selling points. ForgeJS must match it.

```typescript
import { TestCase, createTestApp } from '@forgejs/testing';

class UserTest extends TestCase {
  async setup() {
    await this.refreshDatabase();   // migrate fresh + seeders
  }

  async test_can_create_user() {
    const response = await this.postJson('/api/users', {
      name: 'Aisha',
      email: 'aisha@test.com',
      password: 'secret1234',
      password_confirmation: 'secret1234',
    });

    response.assertStatus(201);
    response.assertJsonPath('data.email', 'aisha@test.com');
    this.assertDatabaseHas('users', { email: 'aisha@test.com' });
  }

  async test_unauthenticated_cannot_list_users() {
    const response = await this.getJson('/api/users');
    response.assertUnauthorized();
  }
}
```

---

## 7. Build Phases & Agent Task Breakdown

This section maps the codebase into discrete, parallelizable tasks for sub-agents.

---

### Phase 1 — Monorepo Scaffolding (Agent: Scaffolding Agent)

**Goal:** Set up the repository infrastructure. No application logic yet.

**Tasks:**
- Initialize a `pnpm` workspaces monorepo
- Create all `packages/*` directories with `package.json`, `tsconfig.json`, and an `index.ts` barrel file
- Set up root `tsconfig.base.json` with strict TypeScript, decorators, and `reflect-metadata`
- Configure `vitest` at the root for unified test running
- Create `create-forgejs` scaffolding CLI package
- Set up `changesets` for versioning

**Acceptance Criteria:**
- `pnpm install` succeeds
- `pnpm build` compiles all packages without errors
- `pnpm test` runs (even with zero tests)

---

### Phase 2 — Core Container & Config (Agent: Core Agent)

**Dependencies:** Phase 1

**Tasks:**
- Implement `@forgejs/core`: `Application`, `Container`, `ServiceProvider` base class
- Implement `@forgejs/config`: `.env` loading, `config()` helper, typed config files
- Implement `@forgejs/facades`: `Facade` base class + Proxy resolution

**Acceptance Criteria:**
- Container can `bind`, `singleton`, `make` with auto-injection via decorators
- `config('app.name')` resolves correctly from `config/app.ts` + `.env`
- Unit tests: 100% coverage on container resolution, singleton behavior, provider lifecycle

---

### Phase 3 — HTTP Layer & Router (Agent: HTTP Agent)

**Dependencies:** Phase 2

**Tasks:**
- Implement `@forgejs/http`: `Request`, `Response`, middleware pipeline (onion model)
- Implement `@forgejs/router`: route registration, groups, resource routes, named routes, route model binding
- Wire up Fastify as the HTTP adapter (internal — users never touch Fastify directly)
- Implement global exception handler → HTTP response mapping

**Acceptance Criteria:**
- `forge serve` boots and handles `GET /health` → `200 OK`
- Middleware executes in correct order
- Named route URL generation works
- Feature tests: CRUD routes + auth middleware

---

### Phase 4 — ORM & Migrations (Agent: ORM Agent)

**Dependencies:** Phase 2

**Tasks:**
- Implement `@forgejs/orm`: `Model` base class, ActiveRecord CRUD, query builder, relationships (`hasOne`, `hasMany`, `belongsTo`, `belongsToMany`), soft deletes, eager loading (`.with()`)
- Implement schema builder: `Schema.create`, column types, indexes, foreign keys
- Implement migration runner: up/down, batch tracking in `forge_migrations` table
- Implement `Factory` and `Seeder` base classes
- Adapters for PostgreSQL and SQLite

**Acceptance Criteria:**
- `forge db:migrate` runs and tracks batches
- `forge db:rollback` reverses last batch
- Model CRUD, soft deletes, and eager loading all pass unit + integration tests (SQLite in-memory)
- Factory generates valid fake model data

---

### Phase 5 — Validation (Agent: Validation Agent)

**Dependencies:** Phase 3

**Tasks:**
- Implement `@forgejs/validation`: rule engine (required, string, min, max, email, unique, in, confirmed, etc.)
- `FormRequest` base class with `rules()` and `authorize()` lifecycle
- Auto-inject `FormRequest` in controller method signatures
- Wire `ValidationException` → 422 response with error bag

**Acceptance Criteria:**
- All standard rules pass tests
- `unique:table` hits the database
- `FormRequest` rejection returns correct 422 shape
- `authorize()` returning false returns 403

---

### Phase 6 — Console / CLI (Agent: CLI Agent)

**Dependencies:** Phase 2, 4

**Tasks:**
- Build the `forge` CLI binary using `commander` or `cac`
- Implement all `make:*` generators from stubs
- Implement `db:migrate`, `db:rollback`, `db:seed`, `db:status`
- Implement `route:list` (reads registered routes, outputs table)
- Implement `tinker` (Node.js REPL with app context)
- Implement `forge serve` with `tsx watch`

**Acceptance Criteria:**
- `forge make:model User --migration` generates both files correctly
- `forge db:migrate` runs migrations in order
- `forge route:list` prints a formatted table
- `forge serve` starts server and hot-reloads on file change

---

### Phase 7 — Queue System (Agent: Queue Agent)

**Dependencies:** Phase 2, 6

**Tasks:**
- Implement `@forgejs/queue` using BullMQ + Redis
- `Job` base class with `handle()`, `failed()`, `queue`, `tries`, `backoff`
- `Job.dispatch()`, `.delay()`, `.chain()`, `.batch()` static API
- `forge queue:work` command with graceful shutdown
- `forge queue:failed` and `forge queue:retry`

**Acceptance Criteria:**
- Jobs dispatch and are consumed by the worker
- Retry + backoff works correctly
- Failed jobs are persisted and retryable
- Chain: jobs execute in sequence; on failure, subsequent jobs are not run

---

### Phase 8 — Events (Agent: Events Agent)

**Dependencies:** Phase 2, 7

**Tasks:**
- Implement `@forgejs/events`: `Event` class, `Listener` base, `EventServiceProvider`
- `Event.dispatch()` fires synchronous listeners
- Queued listeners (with `queue` property) dispatch as Jobs automatically
- Auto-discovery of `EventServiceProvider.listen` map

**Acceptance Criteria:**
- Sync listeners fire in order of registration
- Queued listener dispatches a job to BullMQ
- Wildcard listener works (`Event.listen('*', handler)`)

---

### Phase 9 — Auth (Agent: Auth Agent)

**Dependencies:** Phase 3, 4, 5

**Tasks:**
- JWT guard using `jose` library
- `Auth.attempt()`, `Auth.user()`, `Auth.check()`, `Auth.logout()`
- `AuthMiddleware` that populates `request.user`
- `Policy` base class + `Gate` resolution
- `this.authorize(ability, model)` in Controller base
- Scaffold `AuthController` with `register`, `login`, `logout`, `me` actions

**Acceptance Criteria:**
- `POST /auth/login` returns a signed JWT
- Protected route rejects invalid/missing token with 401
- Policy `update(user, post)` enforces ownership correctly

---

### Phase 10 — Testing Package & create-forgejs (Agent: DX Agent)

**Dependencies:** All above

**Tasks:**
- Implement `@forgejs/testing`: `TestCase`, HTTP test client, `assertDatabaseHas`, `refreshDatabase`, `actingAs`
- Build `create-forgejs` scaffolding CLI: interactive prompts (project name, DB driver, auth yes/no), copies starter template
- Write full example app (REST API for a blog: users, posts, comments) as the `examples/api-only` project
- Write README and getting-started guide

**Acceptance Criteria:**
- `npm create forgejs@latest my-blog` creates a working project
- `cd my-blog && forge serve` boots in < 5 seconds
- Example app passes its own feature test suite
- `assertDatabaseHas` and HTTP assertions work against SQLite test database

---

## 8. Non-Goals (v1.0)

- No view/template engine (API-first; Blade equivalent is post-v1)
- No WebSocket support (post-v1)
- No MongoDB adapter (relational only in v1)
- No multi-tenancy primitives
- No file storage abstraction (S3/local) — post-v1

---

## 9. Technical Constraints

| Constraint | Decision |
|---|---|
| Runtime | Node.js >= 20 (LTS) |
| Language | TypeScript 5.x (strict mode) |
| Decorators | TC39 Stage 3 decorators + `reflect-metadata` |
| HTTP adapter | Fastify (internal — never exposed to users) |
| Package manager | pnpm workspaces |
| Test runner | Vitest |
| ORM transport | `pg`, `mysql2`, `better-sqlite3` |
| Queue backend | BullMQ + Redis |
| Auth tokens | JWT via `jose` |
| Build tool | `tsup` per package |

---

## 10. Resolved Architecture Decisions

### Monorepo vs Separate Projects
All 10 packages live in **one Git repository** using `pnpm` workspaces. Each package is independently publishable to npm under the `@forgejs/` scope, but they share a single CI pipeline, root `tsconfig`, and test runner. This mirrors how Laravel ships `illuminate/*` packages — one repo, many installable packages.

### 1. ORM Query Builder — Wrap Knex Internally
Laravel built its query builder from scratch on raw PDO — but that was a decade of investment. ForgeJS v1 will **wrap Knex internally** as the SQL generation and connection layer. Knex handles dialect differences across PostgreSQL, MySQL, and SQLite out of the box. Users never interact with Knex directly; they only use the Eloquent-style Model API. Post-v1, Knex can be swapped for a custom builder without changing any user-facing code.

### 2. Runtime — Node.js 20 LTS Only (v1)
**Node.js 20+ LTS only for v1.** Bun has compatibility gaps with BullMQ and other production-grade npm packages. Targeting both runtimes from day one splits the testing matrix before anything ships. Bun support will be added in v2 once ecosystem compatibility matures.

### 3. Tinker REPL — Node Built-in `repl` Module
**Use Node's built-in `repl` module with top-level await** (native in Node 20, no flag needed). Boot the full application, inject the container, all Model classes, Facades, and `config()` into the REPL context, then start the session. No third-party dependency. Zero maintenance risk.

### 4. Validation Rules — Mirror Laravel (Both Styles)
**Support both string pipe syntax and Rule builder objects**, exactly as Laravel does:
- Simple: `'required|email|min:3'`
- Complex: `['required', Rule.unique('users').ignore(id)]`

Devs migrating from Laravel will feel zero friction.

### 5. Router — Build on Fastify's `find-my-way`
**Wrap Fastify's `find-my-way` radix-tree router.** It is the fastest HTTP router in the Node.js ecosystem, benchmarking above Express, Koa, and Hono. Building a custom router from scratch adds months of work for zero net performance gain. ForgeJS wraps it with its own API layer (groups, resource routes, named routes, model binding). Users never see Fastify or `find-my-way` directly. The wrapper pattern allows swapping the transport layer in future without breaking user-facing APIs.

---

## 11. Glossary

| Term | Meaning |
|---|---|
| IoC Container | Inversion of Control — class dependencies are resolved automatically |
| ActiveRecord | Pattern where the model object also handles its own DB queries |
| Service Provider | Boot class that registers things into the container |
| Facade | Static-looking proxy to a container-resolved instance |
| Middleware | Function that intercepts a request before it reaches the controller |
| Guard | Auth driver that resolves the authenticated user for a request |
| Policy | Class that defines authorization rules for a specific model |
| FormRequest | Request subclass that validates and authorizes itself before the controller runs |
