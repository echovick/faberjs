# Cache

`@faber-js/cache` provides a unified cache abstraction with drivers for in-memory, Redis, and database storage. The API is identical regardless of driver, making it trivial to swap backends between environments.

Similar to Laravel's Cache facade, FaberJS exposes a `Cache` object with get/put/remember semantics and an optional `RateLimiter` built on top of the same store.

---

## Installation

```bash
pnpm add @faber-js/cache
```

For the Redis driver, also install `ioredis`:

```bash
pnpm add ioredis
```

---

## Configuration

### Register the provider

```typescript
// bootstrap/app.ts
import { CacheServiceProvider } from '@faber-js/cache';
import cacheConfig from '../config/cache';

app.register(new CacheServiceProvider(app, cacheConfig));
```

### Create the config file

```typescript
// config/cache.ts
import { env } from '@faber-js/config';

export default {
  driver: env('CACHE_DRIVER', 'memory') as 'memory' | 'redis' | 'database',

  redis: {
    host: env('REDIS_HOST', '127.0.0.1'),
    port: Number(env('REDIS_PORT', '6379')),
    password: env('REDIS_PASSWORD', undefined),
    db: Number(env('REDIS_DB', '0')),
  },

  // Prefix applied to all cache keys
  prefix: env('CACHE_PREFIX', 'faberjs_cache'),
};
```

### `.env` reference

```ini
CACHE_DRIVER=memory      # memory | redis | database
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
CACHE_PREFIX=faberjs_cache
```

---

## Basic Usage

Import `Cache` from `@faber-js/cache`:

```typescript
import { Cache } from '@faber-js/cache';
```

### Retrieving items

```typescript
// Returns the cached value, or null if it doesn't exist
const value = await Cache.get('users:all');

// Returns a default when the key is missing
const value = await Cache.get('users:all', []);
```

### Storing items

```typescript
// Store for 60 seconds
await Cache.put('users:all', users, 60);

// Store indefinitely
await Cache.forever('settings', config);
```

### Checking existence

```typescript
if (await Cache.has('users:all')) {
  // key exists and is not expired
}

if (await Cache.missing('users:all')) {
  // key does not exist
}
```

### Removing items

```typescript
// Remove a single key
await Cache.forget('users:all');

// Clear the entire cache store
await Cache.flush();
```

---

## Remember (Stale-While-Revalidate)

`Cache.remember` is the most common pattern: retrieve a cached value, or execute a closure to populate and store it.

```typescript
const users = await Cache.remember('users:all', 300, async () => {
  return User.all<User>();
});
```

The second argument is the TTL in **seconds**. The closure runs only on a cache miss; subsequent calls within the TTL return the cached value without hitting the database.

```typescript
// Remember forever (no TTL)
const settings = await Cache.rememberForever('app:settings', async () => {
  return Setting.all();
});
```

---

## Increment & Decrement

Atomic counters are useful for page-view tracking, vote tallying, and quota enforcement:

```typescript
// Increment by 1 (default)
await Cache.increment('page_views');

// Increment by a specific amount
await Cache.increment('downloads', 5);

// Decrement
await Cache.decrement('available_seats');
await Cache.decrement('available_seats', 2);
```

::: tip
Increment/decrement operations are atomic on the Redis driver. On the `memory` driver they are safe within a single process.
:::

---

## Retrieve and Delete

`Cache.pull` retrieves an item and immediately removes it — useful for one-time tokens or flash data:

```typescript
const token = await Cache.pull('password_reset:user:42');
// token is the value; the key is now gone
```

---

## Atomic Locks

Locks prevent race conditions when multiple processes need to perform the same operation. Backed by Redis `SET NX` or an equivalent in-process mutex for the memory driver.

```typescript
import { Cache } from '@faber-js/cache';

const lock = Cache.lock('process-invoices', 30); // 30-second TTL

if (await lock.get()) {
  try {
    await processInvoices();
  } finally {
    await lock.release();
  }
}
```

### Block until acquired

`lock.block(seconds)` waits up to the given number of seconds for the lock to become available:

```typescript
await lock.block(10); // throws LockTimeoutException if not acquired within 10s
try {
  await processInvoices();
} finally {
  await lock.release();
}
```

### Run-and-release shorthand

```typescript
await Cache.lock('send-report', 30).get(async () => {
  await sendWeeklyReport();
  // lock is automatically released when the callback returns
});
```

---

## Rate Limiter

`RateLimiter` is built on the same cache store and provides first-class rate limiting for API endpoints, login attempts, or any recurring action.

```typescript
import { RateLimiter } from '@faber-js/cache';
```

### Checking and consuming attempts

```typescript
const key = `login:${req.ip}`;
const maxHits = 5;
const decaySeconds = 60;

if (await RateLimiter.tooManyAttempts(key, maxHits)) {
  const retryAfter = await RateLimiter.availableIn(key);
  return this.json({ message: `Too many attempts. Retry in ${retryAfter}s.` }, 429);
}

await RateLimiter.hit(key, decaySeconds);
// proceed with the login
```

### `attempt` shorthand

```typescript
const executed = await RateLimiter.attempt(
  `login:${req.ip}`,
  5, // maxAttempts
  async () => {
    return performLogin(req);
  },
  60, // decaySeconds
);

if (!executed) {
  return this.json({ message: 'Too many requests.' }, 429);
}
```

### Remaining attempts

```typescript
const remaining = await RateLimiter.remaining(`login:${req.ip}`, 5);
// number of attempts left before the limit is hit
```

### Clearing a limiter

```typescript
// Reset on successful login
await RateLimiter.clear(`login:${req.ip}`);
```

### `RateLimiter` API reference

| Method                          | Description                                        |
| ------------------------------- | -------------------------------------------------- |
| `attempt(key, max, fn, decay?)` | Run `fn` if under the limit; returns false if over |
| `tooManyAttempts(key, max)`     | Returns `true` when the limit has been reached     |
| `hit(key, decay?)`              | Increment the counter; set TTL on first hit        |
| `remaining(key, max)`           | How many attempts remain                           |
| `availableIn(key)`              | Seconds until the limiter resets                   |
| `clear(key)`                    | Remove the limiter key                             |

---

## Applying Rate Limits in Middleware

```typescript
// app/middleware/ThrottleMiddleware.ts
import { RateLimiter } from '@faber-js/cache';
import type { Request, Response, NextFunction } from '@faber-js/http';

export class ThrottleMiddleware {
  async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
    const key = `throttle:${req.ip}`;

    if (await RateLimiter.tooManyAttempts(key, 60)) {
      const retryAfter = await RateLimiter.availableIn(key);
      res.header('Retry-After', String(retryAfter));
      res.header('X-RateLimit-Limit', '60');
      res.header('X-RateLimit-Remaining', '0');
      res.status(429).send({ message: 'Too Many Requests.' });
      return;
    }

    await RateLimiter.hit(key, 60);
    const remaining = await RateLimiter.remaining(key, 60);
    res.header('X-RateLimit-Limit', '60');
    res.header('X-RateLimit-Remaining', String(remaining));

    await next();
  }
}
```

---

## Testing

`Cache.fake()` replaces the real store with a synchronous in-memory stub. Call it in your test setup, then use the assertion helpers.

```typescript
import { Cache } from '@faber-js/cache';

beforeEach(() => {
  Cache.fake();
});

test('user list is cached', async () => {
  // First call — cache miss, hits the DB
  await Cache.remember('users', 300, async () => [{ id: 1 }]);

  // Second call — cache hit
  const users = await Cache.remember('users', 300, async () => [{ id: 2 }]);

  expect(users).toEqual([{ id: 1 }]);
});

test('cache.put stores a value', async () => {
  await Cache.put('foo', 'bar', 60);

  expect(await Cache.has('foo')).toBe(true);
  expect(await Cache.get('foo')).toBe('bar');
});

test('cache.forget removes a value', async () => {
  await Cache.put('foo', 'bar', 60);
  await Cache.forget('foo');

  expect(await Cache.has('foo')).toBe(false);
});
```

---

## `Cache` API Reference

| Method                           | Description                             |
| -------------------------------- | --------------------------------------- |
| `Cache.get(key, default?)`       | Retrieve a value or return the default  |
| `Cache.put(key, value, ttl)`     | Store a value for `ttl` seconds         |
| `Cache.forever(key, value)`      | Store a value indefinitely              |
| `Cache.remember(key, ttl, fn)`   | Get or compute-and-store                |
| `Cache.rememberForever(key, fn)` | Get or compute-and-store without expiry |
| `Cache.has(key)`                 | Returns `true` if the key exists        |
| `Cache.missing(key)`             | Returns `true` if the key is absent     |
| `Cache.forget(key)`              | Remove a single key                     |
| `Cache.flush()`                  | Clear the entire cache store            |
| `Cache.pull(key)`                | Retrieve and immediately delete         |
| `Cache.increment(key, by?)`      | Increment an integer counter            |
| `Cache.decrement(key, by?)`      | Decrement an integer counter            |
| `Cache.lock(key, ttl)`           | Obtain an atomic lock                   |
| `Cache.fake()`                   | Replace the store with a test stub      |
