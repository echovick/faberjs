# CLI Commands

The `faber` CLI is the Artisan equivalent for FaberJS. It handles code generation, database management, the dev server, route inspection, and an interactive REPL.

Like Artisan, every `faber` command has a description you can see with `--help`:

```bash
npx faber --help
npx faber make --help
npx faber db --help
```

---

## Development server

### `npx faber serve`

Start the development server with hot reload. Watches for file changes using `tsx --watch`.

```bash
npx faber serve
npx faber serve --port 8080
```

**Options:**

| Flag                | Default | Description       |
| ------------------- | ------- | ----------------- |
| `-p, --port <port>` | `3000`  | Port to listen on |

The server reads your `bootstrap/app.ts` file and re-starts automatically on changes. The entry point is `bootstrap/app.ts`.

---

## Database commands

### `npx faber db:migrate`

Run all pending migrations in chronological order. Each migration batch is tracked so rollback knows which files to reverse.

```bash
npx faber db:migrate
```

Output:

```
Migrating: 2024_01_01_000000_create_users_table
Migrated:  2024_01_01_000000_create_users_table (23ms)
Migrating: 2024_01_02_120000_create_posts_table
Migrated:  2024_01_02_120000_create_posts_table (11ms)
```

### `npx faber db:rollback`

Roll back the last batch of migrations by running each `down()` method.

```bash
npx faber db:rollback
```

### `npx faber db:status`

Show which migrations have run and which are pending.

```bash
npx faber db:status
```

Output:

```
Ran                                                   Batch
✓ 2024_01_01_000000_create_users_table               1
✓ 2024_01_02_120000_create_posts_table               1
✗ 2024_01_03_090000_add_bio_to_users_table           -
```

### `npx faber db:seed`

Run all database seeders found in `database/seeders/`.

```bash
npx faber db:seed
```

---

## Code generators

All generators follow the same pattern: they create a new file in the appropriate directory with a stub. File paths are printed to the console on creation.

### `npx faber make:controller <Name>`

Creates `app/controllers/<Name>Controller.ts` with all five resource methods (`index`, `show`, `store`, `update`, `destroy`).

```bash
npx faber make:controller User
# CREATED app/controllers/UserController.ts
```

### `npx faber make:model <Name>`

Creates `app/models/<Name>.ts` with `table` and `fillable` stubs.

```bash
npx faber make:model Post
# CREATED app/models/Post.ts
```

**Options:**

| Flag              | Description                            |
| ----------------- | -------------------------------------- |
| `-m, --migration` | Also create a migration for this model |

```bash
npx faber make:model Post -m
# CREATED app/models/Post.ts
# CREATED database/migrations/2024_01_15_120000_create_posts_table.ts
```

### `npx faber make:service <Name>`

Creates `app/services/<Name>Service.ts` with `@Injectable()` and `extends Service`.

```bash
npx faber make:service User
# CREATED app/services/UserService.ts
```

### `npx faber make:migration <Name>`

Creates a timestamped migration file in `database/migrations/`.

```bash
npx faber make:migration create_comments_table
# CREATED database/migrations/2024_01_15_130000_create_comments_table.ts

npx faber make:migration add_avatar_to_users_table
# CREATED database/migrations/2024_01_15_130001_add_avatar_to_users_table.ts
```

### `npx faber make:job <Name>`

Creates `app/jobs/<Name>Job.ts` with `queue`, `tries`, and a `handle()` stub.

```bash
npx faber make:job SendWelcomeEmail
# CREATED app/jobs/SendWelcomeEmailJob.ts
```

### `npx faber make:event <Name>`

Creates `app/events/<Name>Event.ts` as an interface with a `type` field.

```bash
npx faber make:event UserRegistered
# CREATED app/events/UserRegisteredEvent.ts
```

### `npx faber make:listener <Name>`

Creates `app/listeners/<Name>Listener.ts` with a `handle(event)` stub.

```bash
npx faber make:listener SendWelcomeEmail
# CREATED app/listeners/SendWelcomeEmailListener.ts
```

### `npx faber make:middleware <Name>`

Creates `app/middleware/<Name>Middleware.ts` implementing the `Middleware` interface.

```bash
npx faber make:middleware Throttle
# CREATED app/middleware/ThrottleMiddleware.ts
```

### `npx faber make:provider <Name>`

Creates `app/providers/<Name>ServiceProvider.ts` with `register()` and `boot()` stubs.

```bash
npx faber make:provider Payment
# CREATED app/providers/PaymentServiceProvider.ts
```

### `npx faber make:command <Name>`

Creates `app/commands/<Name>Command.ts` with a `signature`, `description`, and `handle()` method.

```bash
npx faber make:command SendDailyReport
# CREATED app/commands/SendDailyReportCommand.ts
```

The generated stub:

```typescript
import { Command } from '@faber-js/console';

export class SendDailyReportCommand extends Command {
  readonly signature = 'send-daily-report';
  readonly description = 'SendDailyReport command description';

  async handle(): Promise<void> {
    this.info('Running send-daily-report...');
  }
}
```

### `npx faber make:agent <Name>`

Creates `app/agents/<Name>Agent.ts` with a `model`, `systemPrompt`, and an example `@Tool` method.

```bash
npx faber make:agent Support
# CREATED app/agents/SupportAgent.ts
```

---

## Frontend Bridge

### `npx faber bridge:types`

Scan `resources/pages/` for page components and generate a `BridgePages` type map. The output file is `resources/types/bridge.generated.ts` by default.

```bash
npx faber bridge:types
```

Output:

```
CREATED     resources/types/bridge.generated.ts
INFO        Generated 6 page type(s)
```

The generated file maps each component name (relative to `resources/pages/`) to `Record<string, unknown>`. Edit the generated file or create a `bridge.ts` alongside it to override prop types with your own interfaces.

**Options:**

| Flag              | Default                              | Description                           |
| ----------------- | ------------------------------------ | ------------------------------------- |
| `--pages <dir>`   | `resources/pages`                    | Directory to scan for page components |
| `--out <file>`    | `resources/types/bridge.generated.ts`| Output file path                      |

```bash
# Custom paths
npx faber bridge:types --pages src/views --out src/types/pages.ts
```

---

## Route inspection

### `npx faber route:list`

List all registered routes. Reads your application's route files and prints a table.

```bash
npx faber route:list
```

Output:

```
Method   Path                          Controller            Action
GET      /users                        UserController        index
POST     /users                        UserController        store
GET      /users/:id                    UserController        show
PUT      /users/:id                    UserController        update
DELETE   /users/:id                    UserController        destroy
GET      /admin/posts                  PostController        index
POST     /admin/posts                  PostController        store
```

---

## Interactive REPL

### `npx faber tinker`

Start an interactive Node.js REPL with your application already bootstrapped. Like Laravel's `php artisan tinker`, this gives you a live console to test queries, dispatch jobs, and inspect your data.

```bash
npx faber tinker
```

```
FaberJS Tinker — application ready
> await User.all()
> await User.create({ name: 'Alice', email: 'alice@example.com' })
> await dispatch(new SendWelcomeEmailJob(1))
```

---

## Command quick reference

| Command                            | Description                                   |
| ---------------------------------- | --------------------------------------------- |
| `npx faber serve`                  | Start the dev server (hot reload)             |
| `npx faber db:migrate`             | Run pending migrations                        |
| `npx faber db:rollback`            | Roll back the last migration batch            |
| `npx faber db:status`              | Show migration status                         |
| `npx faber db:seed`                | Run database seeders                          |
| `npx faber make:controller <Name>` | Generate a controller                         |
| `npx faber make:model <Name> [-m]` | Generate a model (and optionally a migration) |
| `npx faber make:service <Name>`    | Generate a service                            |
| `npx faber make:migration <Name>`  | Generate a migration                          |
| `npx faber make:job <Name>`        | Generate a job                                |
| `npx faber make:event <Name>`      | Generate an event interface                   |
| `npx faber make:listener <Name>`   | Generate a listener                           |
| `npx faber make:middleware <Name>` | Generate middleware                           |
| `npx faber make:provider <Name>`   | Generate a service provider                   |
| `npx faber make:command <Name>`    | Generate a custom CLI command                 |
| `npx faber make:agent <Name>`      | Generate an AI agent                          |
| `npx faber bridge:types`           | Generate BridgePages type map from pages dir  |
| `npx faber route:list`             | List all registered routes                    |
| `npx faber tinker`                 | Start an interactive REPL                     |
