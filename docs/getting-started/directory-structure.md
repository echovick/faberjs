# Directory Structure

A scaffolded FaberJS application follows a strict convention. Every folder has a single, predictable purpose.

## Top-level overview

```
my-app/
├── app/                ← your application code
├── bootstrap/          ← application boot sequence
├── config/             ← typed configuration files
├── database/           ← migrations and seeders
├── routes/             ← route definitions
├── storage/            ← logs, caches, uploaded files
├── tests/              ← test files
├── .env                ← environment variables
└── tsconfig.json
```

## `app/`

The heart of your application. Organised by role, not by feature.

```
app/
├── controllers/        ← HTTP entry points
├── models/             ← ORM models
├── services/           ← business logic
├── jobs/               ← queued work units
├── events/             ← event type definitions
├── listeners/          ← event handlers
├── policies/           ← authorization policies
├── providers/          ← custom service providers
└── commands/           ← custom CLI commands
```

**controllers/** — One controller per resource. Controllers handle HTTP concerns only: read the request, call a service, return a response. No business logic lives here.

**models/** — One class per database table. Models extend `Model` from `@faber-js/orm` and declare `table`, `fillable`, and `hidden`.

**services/** — Where business logic lives. Services are injectable classes that controllers call. A `UserService` handles everything related to users: creating, finding, updating, deleting.

**jobs/** — Classes that represent work to be done asynchronously. Each job has a `handle()` method and is dispatched via `dispatch()`.

**events/** — Lightweight interfaces that describe something that happened. Events carry data; listeners react to them.

**listeners/** — Classes that respond to events. A listener has a `handle(event)` method. Listeners can be synchronous or queued.

**policies/** — Authorization logic for a model. A `PostPolicy` answers questions like "can this user update this post?"

**providers/** — Service providers register bindings into the IoC container. You create one only when you need to wire up a third-party library.

**commands/** — Custom `faber` CLI commands. Like Artisan commands, each has a `signature`, `description`, and `handle()`.

## `bootstrap/app.ts`

The application boot file. This is where you register service providers and discover route files.

```typescript
import { Application } from '@faber-js/core';
import { HttpServiceProvider } from '@faber-js/http';
import { RouterServiceProvider } from '@faber-js/router';
import { OrmServiceProvider } from '@faber-js/orm';
import { QueueServiceProvider } from '@faber-js/queue';
import { EventServiceProvider } from '@faber-js/events';

const app = new Application(process.cwd());

app.register(new HttpServiceProvider(app));
app.register(new RouterServiceProvider(app));
app.register(new OrmServiceProvider(app));
app.register(new QueueServiceProvider(app));
app.register(new EventServiceProvider(app));

await app.boot();

export { app };
```

## `config/`

Typed configuration files. Each file exports a plain object. Use the `env()` helper to read `.env` values.

```
config/
├── app.ts          ← application name, env, URL
├── database.ts     ← connection settings
└── queue.ts        ← queue driver and connection
```

## `database/`

```
database/
├── migrations/     ← timestamped migration files
└── seeders/        ← database seeders
```

Migration files are discovered automatically by `faber db:migrate` in chronological order.

## `routes/`

Route files are plain TypeScript files that call `Route.*` methods. The scaffolded project includes `routes/api.ts`. Add more route files and import them from `bootstrap/app.ts`.

```typescript
// routes/api.ts
import { Route } from '@faber-js/router';
import { UserController } from '../app/controllers/UserController';

Route.get('/users', [UserController, 'index']);
Route.post('/users', [UserController, 'store']);
Route.get('/users/:id', [UserController, 'show']);
Route.put('/users/:id', [UserController, 'update']);
Route.delete('/users/:id', [UserController, 'destroy']);
```

## `storage/`

Runtime-generated files. This directory is never committed to version control.

```
storage/
├── logs/
└── framework/
```

## `.env`

Environment-specific variables. Never commit this file. The scaffolded project includes a `.env.example` you can copy.

```ini
APP_NAME=my-app
APP_ENV=local
APP_PORT=3000

DB_CLIENT=pg
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=my_app
DB_USER=postgres
DB_PASSWORD=

QUEUE_REDIS_HOST=127.0.0.1
QUEUE_REDIS_PORT=6379

ANTHROPIC_API_KEY=
```
