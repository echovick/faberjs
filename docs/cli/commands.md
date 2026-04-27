# CLI Commands

The `faber` CLI is the Artisan equivalent for FaberJS. It handles code generation, database management, the dev server, route inspection, and an interactive REPL.

Like Artisan, every `faber` command has a description you can see with `--help`:

```bash
faber --help
faber make --help
faber db --help
```

---

## Development server

### `faber serve`

Start the development server with hot reload. Watches for file changes using `tsx --watch`.

```bash
faber serve
faber serve --port 8080
```

**Options:**

| Flag                | Default | Description       |
| ------------------- | ------- | ----------------- |
| `-p, --port <port>` | `3000`  | Port to listen on |

The server reads your `bootstrap/app.ts` file and re-starts automatically on changes. The entry point is `bootstrap/app.ts`.

---

## Database commands

### `faber db:migrate`

Run all pending migrations in chronological order. Each migration batch is tracked so rollback knows which files to reverse.

```bash
faber db:migrate
```

Output:

```
Migrating: 2024_01_01_000000_create_users_table
Migrated:  2024_01_01_000000_create_users_table (23ms)
Migrating: 2024_01_02_120000_create_posts_table
Migrated:  2024_01_02_120000_create_posts_table (11ms)
```

### `faber db:rollback`

Roll back the last batch of migrations by running each `down()` method.

```bash
faber db:rollback
```

### `faber db:status`

Show which migrations have run and which are pending.

```bash
faber db:status
```

Output:

```
Ran                                                   Batch
✓ 2024_01_01_000000_create_users_table               1
✓ 2024_01_02_120000_create_posts_table               1
✗ 2024_01_03_090000_add_bio_to_users_table           -
```

### `faber db:seed`

Run all database seeders found in `database/seeders/`.

```bash
faber db:seed
```

---

## Code generators

All generators follow the same pattern: they create a new file in the appropriate directory with a stub. File paths are printed to the console on creation.

### `faber make:controller <Name>`

Creates `app/controllers/<Name>Controller.ts` with all five resource methods (`index`, `show`, `store`, `update`, `destroy`).

```bash
faber make:controller User
# CREATED app/controllers/UserController.ts
```

### `faber make:model <Name>`

Creates `app/models/<Name>.ts` with `table` and `fillable` stubs.

```bash
faber make:model Post
# CREATED app/models/Post.ts
```

**Options:**

| Flag              | Description                            |
| ----------------- | -------------------------------------- |
| `-m, --migration` | Also create a migration for this model |

```bash
faber make:model Post -m
# CREATED app/models/Post.ts
# CREATED database/migrations/2024_01_15_120000_create_posts_table.ts
```

### `faber make:service <Name>`

Creates `app/services/<Name>Service.ts` with `@Injectable()` and `extends Service`.

```bash
faber make:service User
# CREATED app/services/UserService.ts
```

### `faber make:migration <Name>`

Creates a timestamped migration file in `database/migrations/`.

```bash
faber make:migration create_comments_table
# CREATED database/migrations/2024_01_15_130000_create_comments_table.ts

faber make:migration add_avatar_to_users_table
# CREATED database/migrations/2024_01_15_130001_add_avatar_to_users_table.ts
```

### `faber make:job <Name>`

Creates `app/jobs/<Name>Job.ts` with `queue`, `tries`, and a `handle()` stub.

```bash
faber make:job SendWelcomeEmail
# CREATED app/jobs/SendWelcomeEmailJob.ts
```

### `faber make:event <Name>`

Creates `app/events/<Name>Event.ts` as an interface with a `type` field.

```bash
faber make:event UserRegistered
# CREATED app/events/UserRegisteredEvent.ts
```

### `faber make:listener <Name>`

Creates `app/listeners/<Name>Listener.ts` with a `handle(event)` stub.

```bash
faber make:listener SendWelcomeEmail
# CREATED app/listeners/SendWelcomeEmailListener.ts
```

### `faber make:middleware <Name>`

Creates `app/middleware/<Name>Middleware.ts` implementing the `Middleware` interface.

```bash
faber make:middleware Throttle
# CREATED app/middleware/ThrottleMiddleware.ts
```

### `faber make:provider <Name>`

Creates `app/providers/<Name>ServiceProvider.ts` with `register()` and `boot()` stubs.

```bash
faber make:provider Payment
# CREATED app/providers/PaymentServiceProvider.ts
```

### `faber make:command <Name>`

Creates `app/commands/<Name>Command.ts` with a `signature`, `description`, and `handle()` method.

```bash
faber make:command SendDailyReport
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

### `faber make:agent <Name>`

Creates `app/agents/<Name>Agent.ts` with a `model`, `systemPrompt`, and an example `@Tool` method.

```bash
faber make:agent Support
# CREATED app/agents/SupportAgent.ts
```

---

## Route inspection

### `faber route:list`

List all registered routes. Reads your application's route files and prints a table.

```bash
faber route:list
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

### `faber tinker`

Start an interactive Node.js REPL with your application already bootstrapped. Like Laravel's `php artisan tinker`, this gives you a live console to test queries, dispatch jobs, and inspect your data.

```bash
faber tinker
```

```
FaberJS Tinker — application ready
> await User.all()
> await User.create({ name: 'Alice', email: 'alice@example.com' })
> await dispatch(new SendWelcomeEmailJob(1))
```

---

## Command quick reference

| Command                        | Description                                   |
| ------------------------------ | --------------------------------------------- |
| `faber serve`                  | Start the dev server (hot reload)             |
| `faber db:migrate`             | Run pending migrations                        |
| `faber db:rollback`            | Roll back the last migration batch            |
| `faber db:status`              | Show migration status                         |
| `faber db:seed`                | Run database seeders                          |
| `faber make:controller <Name>` | Generate a controller                         |
| `faber make:model <Name> [-m]` | Generate a model (and optionally a migration) |
| `faber make:service <Name>`    | Generate a service                            |
| `faber make:migration <Name>`  | Generate a migration                          |
| `faber make:job <Name>`        | Generate a job                                |
| `faber make:event <Name>`      | Generate an event interface                   |
| `faber make:listener <Name>`   | Generate a listener                           |
| `faber make:middleware <Name>` | Generate middleware                           |
| `faber make:provider <Name>`   | Generate a service provider                   |
| `faber make:command <Name>`    | Generate a custom CLI command                 |
| `faber make:agent <Name>`      | Generate an AI agent                          |
| `faber route:list`             | List all registered routes                    |
| `faber tinker`                 | Start an interactive REPL                     |
