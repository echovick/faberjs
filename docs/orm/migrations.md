# Migrations

Migrations are version-controlled schema changes. Each migration file has an `up()` method that applies the change and a `down()` method that reverses it.

## Creating a migration

```bash
faber make:migration create_posts_table
```

When creating a migration alongside a model, use the `-m` flag:

```bash
faber make:model Post -m
```

Generated file (`database/migrations/2024_01_15_120000_create_posts_table.ts`):

```typescript
import { Migration, Schema } from '@faber-js/orm';

export default class CreatePostsTable extends Migration {
  async up(): Promise<void> {
    await Schema.create('posts', (table) => {
      table.id();
      table.timestamps();
    });
  }

  async down(): Promise<void> {
    await Schema.dropIfExists('posts');
  }
}
```

## Running migrations

```bash
faber db:migrate      # run all pending migrations
faber db:rollback     # roll back the last batch
faber db:status       # show migration status
```

Migrations run in chronological order based on the timestamp in the filename. Each batch is tracked so `rollback` knows which migrations to reverse together.

## Schema builder

The `Schema` object from `@faber-js/orm` provides methods to create, alter, and drop tables.

### `Schema.create(table, callback)`

Create a new table. The callback receives a `Blueprint` instance.

```typescript
await Schema.create('users', (table) => {
  table.id();
  table.string('name');
  table.string('email').unique();
  table.string('password');
  table.timestamps();
});
```

### `Schema.dropIfExists(table)`

Drop a table if it exists. Always use this in `down()`.

```typescript
await Schema.dropIfExists('users');
```

## Blueprint methods

The `table` argument passed to the `create` callback is a `Blueprint`. All methods return a `ColumnDefinition` that can be chained further.

### Column types

| Method                                   | SQL type              | Notes                                                   |
| ---------------------------------------- | --------------------- | ------------------------------------------------------- |
| `table.id()`                             | `SERIAL PRIMARY KEY`  | Auto-increment integer primary key                      |
| `table.string(col, length?)`             | `VARCHAR(255)`        | Default length 255                                      |
| `table.text(col)`                        | `TEXT`                | Unbounded string                                        |
| `table.integer(col)`                     | `INTEGER`             |                                                         |
| `table.bigInteger(col)`                  | `BIGINT`              |                                                         |
| `table.boolean(col)`                     | `BOOLEAN`             |                                                         |
| `table.decimal(col, precision?, scale?)` | `DECIMAL(8, 2)`       | Default 8,2                                             |
| `table.json(col)`                        | `JSON`                |                                                         |
| `table.timestamp(col)`                   | `TIMESTAMP`           | Nullable by default                                     |
| `table.timestamps()`                     | Two TIMESTAMP columns | Adds `created_at` and `updated_at` with default `NOW()` |
| `table.softDeletes()`                    | `TIMESTAMP NULL`      | Adds `deleted_at` column                                |

### Column modifiers

Chain these on any column definition:

```typescript
table.string('bio').nullable();
table.string('slug').notNullable();
table.string('role').defaultTo('user');
table.integer('sort_order').unsigned();
table.string('email').unique();
```

### Indexes

```typescript
table.index(['status', 'created_at']); // composite index
table.uniqueIndex(['email', 'tenant_id']); // composite unique index
```

## A real migration example

```typescript
import { Migration, Schema } from '@faber-js/orm';

export default class CreatePostsTable extends Migration {
  async up(): Promise<void> {
    await Schema.create('posts', (table) => {
      table.id();
      table.integer('user_id').unsigned().notNullable();
      table.string('title').notNullable();
      table.string('slug').unique().notNullable();
      table.text('body');
      table.boolean('published').defaultTo(false);
      table.timestamp('published_at').nullable();
      table.json('meta').nullable();
      table.timestamps();
      table.softDeletes();
    });
  }

  async down(): Promise<void> {
    await Schema.dropIfExists('posts');
  }
}
```

## Adding columns to an existing table

For modifying an existing table, use `Schema.alter()` (via Knex):

```typescript
import { Migration, Schema } from '@faber-js/orm';

export default class AddBioToUsersTable extends Migration {
  async up(): Promise<void> {
    // Knex table builder via Schema.alter:
    await Schema.alter('users', (table) => {
      table.string('bio').nullable();
    });
  }

  async down(): Promise<void> {
    await Schema.alter('users', (table) => {
      table.dropColumn('bio');
    });
  }
}
```

## Migration naming conventions

Filenames are prefixed with a timestamp (`YYYY_MM_DD_HHMMSS_`) followed by a snake_case description:

```
2024_01_01_000000_create_users_table.ts
2024_01_02_120000_create_posts_table.ts
2024_01_03_090000_add_bio_to_users_table.ts
```

The `faber make:migration` command generates the timestamp automatically.

## Database seeders

Seeders populate the database with test or default data. Generate one with:

```bash
faber make:migration seed_users   # convention: prefix with seed_
```

Or write a seeder class manually in `database/seeders/` and run it:

```bash
faber db:seed
```
