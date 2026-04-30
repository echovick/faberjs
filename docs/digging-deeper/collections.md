# Collections & Support Utilities

`@faber-js/support` provides three orthogonal utilities that address common data-manipulation needs in backend services:

- **`Collection`** — a fluent, chainable wrapper around arrays of objects
- **`Str`** — string helpers with a `Str.of(value)` fluent chainable API
- **`Arr`** — static array helpers for common operations
- **`Pipeline`** — a linear value-transformation pipeline modelled on Laravel's `Pipeline` class

All utilities are included with `@faber-js/support`. No service provider registration is needed.

---

## Installation

```bash
pnpm add @faber-js/support
```

---

## Collections

A `Collection` wraps an array and exposes a rich method API without mutating the original data. Collections are ideal for transforming database results, applying business rules, and building API response payloads.

### Creating a collection

```typescript
import { collect, Collection } from '@faber-js/support';

// From the global helper
const users = collect([
  { id: 1, name: 'Alice', role: 'admin',  score: 95 },
  { id: 2, name: 'Bob',   role: 'editor', score: 82 },
  { id: 3, name: 'Carol', role: 'admin',  score: 78 },
]);

// From the static constructor
const users = Collection.make([...]);

// From a model query
const posts = collect(await Post.all<Post>());
```

---

### Transforming items

#### `map`

Apply a callback to every item and return a new collection:

```typescript
const names = collect(users).map((u) => u.name);
// Collection ['Alice', 'Bob', 'Carol']
```

#### `filter`

Keep only items that pass the predicate:

```typescript
const admins = collect(users).filter((u) => u.role === 'admin');
// Collection [{ id: 1, ... }, { id: 3, ... }]
```

#### `reduce`

Reduce to a single value:

```typescript
const totalScore = collect(users).reduce((carry, u) => carry + u.score, 0);
// 255
```

#### `flatMap` / `flatten`

```typescript
const tags = collect(posts).flatMap((post) => post.tags);

const flat = collect([
  [1, 2],
  [3, 4],
]).flatten();
// Collection [1, 2, 3, 4]
```

---

### Accessing items

```typescript
const first = collect(users).first(); // { id: 1, ... }
const last = collect(users).last(); // { id: 3, ... }

// With a predicate
const alice = collect(users).first((u) => u.name === 'Alice');

// By index
const second = collect(users).nth(1); // { id: 2, ... }
```

---

### Plucking values

Extract a single field from every item:

```typescript
const ids = collect(users).pluck('id'); // Collection [1, 2, 3]
const names = collect(users).pluck('name'); // Collection ['Alice', 'Bob', 'Carol']

// As a plain array
const idArray = collect(users).pluck('id').all(); // [1, 2, 3]
```

---

### Grouping

```typescript
const byRole = collect(users).groupBy('role');
// Map { 'admin' => [...], 'editor' => [...] }

// With a callback
const grouped = collect(users).groupBy((u) => (u.score >= 90 ? 'high' : 'low'));
```

---

### Sorting

```typescript
// Sort ascending by a field
const sorted = collect(users).sortBy('name');

// Sort descending
const sortedDesc = collect(users).sortByDesc('score');

// Custom sort
const custom = collect(users).sort((a, b) => a.name.localeCompare(b.name));
```

---

### Chunking and pagination

```typescript
const pages = collect(users).chunk(2);
// Collection [ Collection [user1, user2], Collection [user3] ]

const page2 = collect(users).skip(10).take(10);
```

---

### Unique values

```typescript
// Remove duplicates by value (for primitives)
const unique = collect([1, 1, 2, 3, 3]).unique();

// Remove duplicates by key
const uniqueRoles = collect(users).unique('role');
```

---

### Statistical methods

```typescript
const scores = collect(users).pluck('score');

scores.sum(); // 255
scores.avg(); // 85
scores.min(); // 78
scores.max(); // 95
scores.count(); // 3
```

---

### Partition

Split a collection into two based on a predicate:

```typescript
const [admins, others] = collect(users).partition((u) => u.role === 'admin');
// admins → Collection [alice, carol]
// others → Collection [bob]
```

---

### Iterating

```typescript
collect(users).each((u) => {
  console.log(u.name);
});
```

---

### Converting back to plain arrays

```typescript
const arr = collect(users).all(); // raw array
const json = collect(users).toJson(); // JSON string
const obj = collect(users).toArray(); // alias for all()
const count = collect(users).count(); // 3
const empty = collect([]).isEmpty(); // true
const filled = collect(users).isNotEmpty(); // true
```

---

### Method reference

| Method                | Description                                 |
| --------------------- | ------------------------------------------- |
| `map(fn)`             | Transform each item                         |
| `filter(fn)`          | Keep items matching the predicate           |
| `first(fn?)`          | First item, optionally matching a predicate |
| `last(fn?)`           | Last item, optionally matching a predicate  |
| `each(fn)`            | Iterate without transforming                |
| `pluck(key)`          | Extract a single field                      |
| `groupBy(key\|fn)`    | Group items into a `Map`                    |
| `chunk(size)`         | Split into pages of `size`                  |
| `unique(key?)`        | Remove duplicates                           |
| `sort(fn?)`           | Custom sort                                 |
| `sortBy(key)`         | Sort ascending by a field                   |
| `sortByDesc(key)`     | Sort descending by a field                  |
| `sum(key?)`           | Sum of numeric values                       |
| `avg(key?)`           | Average of numeric values                   |
| `min(key?)`           | Minimum value                               |
| `max(key?)`           | Maximum value                               |
| `flatten(depth?)`     | Flatten nested arrays                       |
| `take(n)`             | Keep first `n` items                        |
| `skip(n)`             | Skip first `n` items                        |
| `reduce(fn, initial)` | Reduce to a single value                    |
| `partition(fn)`       | Split into two collections                  |
| `count()`             | Number of items                             |
| `isEmpty()`           | True when empty                             |
| `all()`               | Return the underlying array                 |
| `toJson()`            | JSON-encode the collection                  |

---

## Str — String Helpers

`Str` provides static helpers and a fluent chainable API via `Str.of(value)`.

```typescript
import { Str } from '@faber-js/support';
```

### Static helpers

```typescript
Str.camel('hello_world'); // 'helloWorld'
Str.snake('HelloWorld'); // 'hello_world'
Str.kebab('HelloWorld'); // 'hello-world'
Str.studly('hello_world'); // 'HelloWorld'
Str.slug('Hello World!'); // 'hello-world'
Str.title('hello world'); // 'Hello World'
Str.upper('hello'); // 'HELLO'
Str.lower('HELLO'); // 'hello'

Str.limit('A long sentence.', 10); // 'A long sen...'
Str.limit('A long sentence.', 10, ' [...]'); // 'A long sen [...]'

Str.contains('Hello World', 'World'); // true
Str.startsWith('Hello', 'He'); // true
Str.endsWith('Hello', 'lo'); // true

Str.padLeft('5', 3, '0'); // '005'
Str.padRight('hi', 5, '-'); // 'hi---'

Str.uuid(); // 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
Str.random(16); // 'aBcDeFgHiJkLmNoP' — cryptographically random

Str.plural('user'); // 'users'
Str.singular('users'); // 'user'

Str.wordCount('hello world'); // 2
Str.words('hello world', 1); // 'hello...'
```

### Fluent API — `Str.of(value)`

Chain operations without intermediate variables:

```typescript
const slug = Str.of('  Hello World!  ').trim().lower().slug().value();
// 'hello-world'

const headline = Str.of('breaking_news_story').snake().replace('_', ' ').title().value();
// 'Breaking News Story'
```

| Fluent method               | Description                  |
| --------------------------- | ---------------------------- |
| `.camel()`                  | Convert to camelCase         |
| `.snake()`                  | Convert to snake_case        |
| `.kebab()`                  | Convert to kebab-case        |
| `.studly()`                 | Convert to StudlyCase        |
| `.slug()`                   | URL-safe slug                |
| `.title()`                  | Title Case                   |
| `.upper()`                  | UPPERCASE                    |
| `.lower()`                  | lowercase                    |
| `.trim()`                   | Trim whitespace              |
| `.limit(n, end?)`           | Truncate to `n` characters   |
| `.replace(search, replace)` | String replacement           |
| `.prepend(str)`             | Prepend a string             |
| `.append(str)`              | Append a string              |
| `.value()`                  | Return the underlying string |
| `.toString()`               | Alias for `.value()`         |

---

## Arr — Array Helpers

`Arr` provides static helpers for common array operations that are verbose in plain JavaScript:

```typescript
import { Arr } from '@faber-js/support';
```

```typescript
// Wrap a value or array in an array (no-op if already an array)
Arr.wrap('hello'); // ['hello']
Arr.wrap(['a', 'b']); // ['a', 'b']
Arr.wrap(null); // []

// Chunk an array into sub-arrays of a given size
Arr.chunk([1, 2, 3, 4, 5], 2); // [[1, 2], [3, 4], [5]]

// Flatten nested arrays
Arr.flatten([1, [2, [3]]]); // [1, 2, 3]
Arr.flatten([1, [2, [3]]], 1); // [1, 2, [3]] — depth-limited

// Remove duplicates
Arr.unique([1, 1, 2, 3, 3]); // [1, 2, 3]
Arr.unique(users, 'role'); // unique by field

// Pluck a field from each item
Arr.pluck(users, 'id'); // [1, 2, 3]

// Group by field or callback
Arr.groupBy(users, 'role'); // { admin: [...], editor: [...] }

// Shuffle (Fisher-Yates)
Arr.shuffle([1, 2, 3, 4]); // e.g. [3, 1, 4, 2]

// Zip arrays together
Arr.zip([1, 2, 3], ['a', 'b', 'c']); // [[1, 'a'], [2, 'b'], [3, 'c']]

// First and last
Arr.first([10, 20, 30]); // 10
Arr.last([10, 20, 30]); // 30
```

### `Arr` reference

| Method                      | Description                    |
| --------------------------- | ------------------------------ |
| `Arr.wrap(value)`           | Ensure the value is an array   |
| `Arr.chunk(arr, size)`      | Split into sub-arrays          |
| `Arr.flatten(arr, depth?)`  | Flatten nested arrays          |
| `Arr.unique(arr, key?)`     | Remove duplicates              |
| `Arr.pluck(arr, key)`       | Extract a field from each item |
| `Arr.groupBy(arr, key\|fn)` | Group items into an object     |
| `Arr.shuffle(arr)`          | Randomly reorder               |
| `Arr.zip(...arrays)`        | Interleave multiple arrays     |
| `Arr.first(arr)`            | First element                  |
| `Arr.last(arr)`             | Last element                   |

---

## Pipeline

`Pipeline` passes a value through a series of transformation functions (stages). Unlike method chaining, stages are defined as standalone functions, making them easily testable and reusable.

Similar to Laravel's `Pipeline` class, FaberJS uses the same `send → through → thenReturn` pattern.

```typescript
import { Pipeline } from '@faber-js/support';
```

### Basic usage

```typescript
const result = await Pipeline.make()
  .send({ name: '  alice  ', email: 'ALICE@EXAMPLE.COM' })
  .through(
    (payload, next) => next({ ...payload, name: payload.name.trim() }),
    (payload, next) => next({ ...payload, email: payload.email.toLowerCase() }),
    (payload, next) => next({ ...payload, slug: Str.slug(payload.name) }),
  )
  .thenReturn();

// { name: 'alice', email: 'alice@example.com', slug: 'alice' }
```

### Named stage functions

Extract stages into named functions for clarity and reuse:

```typescript
function trimStrings(payload: Dto, next: (p: Dto) => Promise<Dto>) {
  return next(
    Object.fromEntries(
      Object.entries(payload).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]),
    ) as Dto,
  );
}

function normalizeEmail(payload: Dto, next: (p: Dto) => Promise<Dto>) {
  return next({ ...payload, email: payload.email.toLowerCase() });
}

const cleaned = await Pipeline.make()
  .send(rawInput)
  .through(trimStrings, normalizeEmail)
  .thenReturn();
```

### `then` — custom destination

Use `.then(fn)` instead of `.thenReturn()` when the terminal step differs from the transformation chain:

```typescript
const user = await Pipeline.make()
  .send(rawInput)
  .through(trimStrings, normalizeEmail, hashPassword)
  .then(async (data) => {
    return User.create<User>(data);
  });
```

### Pipeline API reference

| Method             | Description                                          |
| ------------------ | ---------------------------------------------------- |
| `Pipeline.make()`  | Create a new pipeline instance                       |
| `.send(value)`     | Set the value to pass through stages                 |
| `.through(...fns)` | Register transformation stage functions              |
| `.thenReturn()`    | Execute the pipeline and return the final value      |
| `.then(fn)`        | Execute the pipeline with a custom terminal function |
