# Schema-First Everything

**Package:** `@faber-js/schema`  
**Depends on:** `@faber-js/orm`, `@faber-js/validation`, `@faber-js/core`  
**Estimated effort:** 4-6 weeks  
**Priority:** Critical path

---

## Goal

One schema declaration that generates the database migration, the ORM model, the TypeScript type, the validation rules, the OpenAPI spec, and a test factory. No duplication, no drift.

---

## API Design

### Declaring a Schema

```typescript
// schema/User.ts
import { schema, t } from '@faber-js/schema';

export const User = schema('users', {
  id: t.id(),
  name: t.string().min(2).max(100),
  email: t.email().unique(),
  password: t.string().hidden(),
  role: t.enum(['admin', 'editor', 'viewer']).default('viewer'),
  bio: t.text().nullable(),
  createdAt: t.timestamp().auto(),
  updatedAt: t.timestamp().auto(),
});
```

### What Gets Generated

#### 1. TypeScript Type

```typescript
// Inferred automatically — no manual type writing
type User = {
  id: number;
  name: string;
  email: string;
  password: string; // present on model, excluded from JSON by default
  role: 'admin' | 'editor' | 'viewer';
  bio: string | null;
  createdAt: Date;
  updatedAt: Date;
};
```

#### 2. ORM Model

```typescript
// Generated model extends the schema-aware base
const user = await User.find(1); // → User type inferred
const users = await User.where('role', 'admin').get(); // → User[]

await User.create({
  name: 'Alice', // TypeScript enforces the shape
  email: 'a@b.com',
  // role defaults to 'viewer' automatically
});
```

#### 3. Migration

```bash
faber db:migrate
```

The schema definition IS the migration source. FaberJS compares the current schema to the database state and generates the diff. No separate migration file writing for simple column changes.

For complex changes (rename column, change type with data transform), migrations are explicitly authored:

```typescript
// database/migrations/2024_01_15_rename_bio.ts
export default class extends Migration {
  async up() {
    await Schema.alter('users', (table) => {
      table.renameColumn('bio', 'biography');
    });
  }
}
```

#### 4. Validation Rules

```typescript
// In FormRequest — rules derived automatically from schema
class StoreUserRequest extends FormRequest {
  rules() {
    return User.rules(['name', 'email', 'password', 'role']);
  }
}

// Or with overrides
class UpdateUserRequest extends FormRequest {
  rules() {
    return User.rules(['name', 'bio'], {
      name: ['required', 'string', 'min:2'], // override individual fields
    });
  }
}
```

#### 5. OpenAPI Schema

```typescript
// Automatic — included in Route definition
Route.post('/users', [UserController, 'store']).request(StoreUserRequest).response(User); // uses User schema for response shape

// /_faber/api-docs generates the full OpenAPI spec
```

#### 6. Test Factory

```typescript
// auto-generated from schema
const user = User.factory().make();
// → { id: 1, name: 'John Smith', email: 'john@example.com', role: 'viewer', ... }

const admin = User.factory().state({ role: 'admin' }).create();
// persists to test DB

const users = User.factory().times(5).create();
```

---

## Field Types

### Primitive Types

| Type                   | Method                        | Notes                        |
| ---------------------- | ----------------------------- | ---------------------------- |
| Auto-increment integer | `t.id()`                      | Primary key, always present  |
| String (varchar)       | `t.string(length?)`           | Default length 255           |
| Text (longtext)        | `t.text()`                    | Unbounded string             |
| Integer                | `t.integer()`                 | 32-bit signed                |
| Big integer            | `t.bigInteger()`              | 64-bit signed                |
| Float                  | `t.float()`                   | Double precision             |
| Decimal                | `t.decimal(precision, scale)` | For currency                 |
| Boolean                | `t.boolean()`                 | Maps to tinyint(1) in MySQL  |
| Date                   | `t.date()`                    | Date only                    |
| Timestamp              | `t.timestamp()`               | Date + time                  |
| JSON                   | `t.json()`                    | Stored as JSON column, typed |
| UUID                   | `t.uuid()`                    | Auto-generated if `.auto()`  |
| Enum                   | `t.enum([...values])`         | Generates TS union type      |

### Modifier Chain

```typescript
t.string()
  .min(2) // validation: min length 2
  .max(100) // validation: max length 100
  .nullable() // DB: NULL allowed, TS: type | null
  .unique() // DB: UNIQUE constraint
  .default('value') // DB: DEFAULT, TS: optional on create
  .hidden() // excluded from JSON/toObject by default
  .auto() // auto-populated (timestamps, UUIDs)
  .index() // adds DB index
  .unsigned(); // for integers: no negative values
```

### Relationship Declarations

```typescript
export const Post = schema('posts', {
  id: t.id(),
  title: t.string(),
  userId: t.foreignId('users'), // foreign key, adds DB constraint
  content: t.text(),
  // ...
});

// Relationships declared separately, typed by the schema
Post.hasMany(Comment, { foreignKey: 'postId' });
Post.belongsTo(User, { foreignKey: 'userId' });
```

---

## CLI Integration

### `faber make:schema <Name>`

Generates `schema/<Name>.ts` with a stub declaration.

### `faber db:migrate` (enhanced)

Before running migrations, the schema compiler:

1. Reads all `schema/*.ts` files
2. Compares each schema to the current DB state
3. Generates migration SQL for any additions (new columns, new tables)
4. Warns about destructive changes (column removal, type changes) — requires explicit authored migration

### `faber db:status` (enhanced)

Shows schema drift: which tables/columns exist in schema but not DB, or in DB but not schema.

### `faber schema:types`

Writes generated TypeScript interfaces to `types/schema.d.ts` — useful for editors that don't pick up the inferred types.

---

## Package Structure

```
packages/schema/
├── src/
│   ├── index.ts          — exports: schema, t, SchemaDefinition, FieldBuilder
│   ├── schema.ts         — schema() factory function, SchemaDefinition class
│   ├── field-builder.ts  — t.string(), t.integer(), etc. — fluent field builder
│   ├── types.ts          — FieldType, FieldOptions, SchemaShape, InferSchema<T>
│   ├── model-mixin.ts    — adds .factory(), .rules(), .openapi() to ORM model
│   ├── factory.ts        — Schema-aware factory with faker integration
│   ├── migration-syncer.ts — compares schema to DB, generates migration SQL
│   ├── validation-bridge.ts — maps field modifiers to @faber-js/validation rules
│   ├── openapi.ts        — generates OpenAPI 3.1 schema from definition
│   └── schema-service-provider.ts
├── package.json
├── tsup.config.ts
└── tsconfig.json
```

---

## Implementation Steps

### Step 1 — Field Builder (Week 1)

Build `FieldBuilder` and the `t` type map. All primitive types with the full modifier chain. Types must be sound: `t.string().nullable()` must produce `TS: string | null`, not `string`.

Key challenge: TypeScript conditional types for inferring the final shape from a chain of modifiers.

```typescript
type InferField<F extends FieldBuilder<any>> = F['_nullable'] extends true
  ? F['_type'] | null
  : F['_type'];

type InferSchema<S extends Record<string, FieldBuilder<any>>> = {
  [K in keyof S]: InferField<S[K]>;
};
```

### Step 2 — Schema Factory and ORM Bridge (Week 2)

`schema(table, shape)` returns a class that:

- Extends `Model` from `@faber-js/orm`
- Has the inferred TypeScript type via `InferSchema<shape>`
- Carries the raw schema definition for downstream use (migration, validation, OpenAPI)

The model's `table`, `hidden`, and `fillable` are derived from the schema.

### Step 3 — Validation Bridge (Week 2)

Map field modifiers to validation rules:

| Field modifier  | Validation rule       |
| --------------- | --------------------- |
| `.min(n)`       | `min:n`               |
| `.max(n)`       | `max:n`               |
| `.nullable()`   | `nullable`            |
| `.email()`      | `email`               |
| `.unique()`     | `unique:table,column` |
| `t.integer()`   | `integer`             |
| `t.boolean()`   | `boolean`             |
| `t.enum([...])` | `in:a,b,c`            |

`User.rules(['name', 'email'])` returns a validation rules object usable directly in `FormRequest.rules()`.

### Step 4 — Factory System (Week 3)

Integrate `@faker-js/faker` for sensible defaults per field type:

| Field type                          | Default factory            |
| ----------------------------------- | -------------------------- |
| `t.string()` with field name `name` | `faker.person.fullName()`  |
| `t.email()`                         | `faker.internet.email()`   |
| `t.string()`                        | `faker.lorem.words(3)`     |
| `t.integer()`                       | `faker.number.int()`       |
| `t.boolean()`                       | `faker.datatype.boolean()` |
| `t.timestamp().auto()`              | `new Date()`               |
| `t.enum([...values])`               | random pick from values    |
| `t.uuid().auto()`                   | `faker.string.uuid()`      |

```typescript
User.factory().make(); // no DB write
User.factory().create(); // writes to DB
User.factory().times(5).create();
User.factory().state({ role: 'admin' }).create();
User.factory()
  .state((faker) => ({ name: faker.person.firstName() }))
  .make();
```

### Step 5 — Migration Syncer (Week 4)

Read current DB schema (via `INFORMATION_SCHEMA` for MySQL/PG, `PRAGMA` for SQLite) and compare to declared schema. Generate safe migration SQL for:

- New table → full `CREATE TABLE`
- New column → `ALTER TABLE ADD COLUMN`
- Column becomes nullable → `ALTER TABLE MODIFY COLUMN`
- New unique constraint → `CREATE UNIQUE INDEX`
- New foreign key → `ALTER TABLE ADD CONSTRAINT`

Emit warnings (not automatic migrations) for:

- Column removal (destructive)
- Column type change (may lose data)
- Column rename (can't infer intent)

### Step 6 — OpenAPI Generator (Week 5)

Generate OpenAPI 3.1 component schemas:

```json
{
  "components": {
    "schemas": {
      "User": {
        "type": "object",
        "properties": {
          "id": { "type": "integer" },
          "name": { "type": "string", "minLength": 2, "maxLength": 100 },
          "email": { "type": "string", "format": "email" },
          "role": { "type": "string", "enum": ["admin", "editor", "viewer"] },
          "createdAt": { "type": "string", "format": "date-time" }
        },
        "required": ["id", "name", "email", "role", "createdAt"]
      }
    }
  }
}
```

Hidden fields (`.hidden()`) are excluded from the response schema but included in the request schema where appropriate.

### Step 7 — CLI Integration and Console Generator (Week 6)

- `faber make:schema <Name>` stub generator
- `faber db:migrate` integration with syncer
- `faber db:status` drift detection
- `faber schema:types` file output
- Update `faber make:model` to generate schema-first models

---

## Migration Strategy for Existing Apps

Schema-first is opt-in. Existing apps continue working with separate model + migration files. Gradually migrate models to schema-first by:

1. Creating `schema/ModelName.ts` alongside the existing `models/ModelName.ts`
2. Running `faber schema:validate` to confirm schema matches existing DB
3. Replacing the model class with the schema-generated one
4. Deleting old migration files and using schema drift detection going forward

---

## Dependencies to Add

```json
{
  "@faker-js/faker": "^8.0.0"
}
```

No other new dependencies. Works with existing Knex connection from `@faber-js/orm`.

---

## Testing Plan

- Unit tests for every field type and modifier combination
- TypeScript inference tests (using `expectTypeOf` from vitest)
- Integration tests: declare schema → run migration → create record → validate → serialize
- Factory tests with SQLite
- OpenAPI output snapshot tests
