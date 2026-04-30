# HTTP Client

`@faber-js/http-client` provides an expressive, fluent API for making outbound HTTP requests. It is built on top of the global `fetch` API (Node.js 18+) with zero additional runtime dependencies, so no installation step is required beyond the package itself.

Similar to Laravel's `Http` facade, FaberJS exposes an `Http` object with a clean builder API for configuring headers, authentication, retries, and timeouts before sending.

---

## Installation

The HTTP client is included with `@faber-js/http-client`. No extra dependencies are required.

```bash
pnpm add @faber-js/http-client
```

No service provider registration is needed — the `Http` facade is available immediately after import.

---

## Basic Usage

```typescript
import { Http } from '@faber-js/http-client';

// GET
const response = await Http.get('https://api.example.com/users');

// POST with JSON body
const response = await Http.post('https://api.example.com/users', {
  name: 'Alice',
  email: 'alice@example.com',
});

// PUT / PATCH / DELETE
await Http.put('https://api.example.com/users/1', { name: 'Alice Smith' });
await Http.patch('https://api.example.com/users/1', { name: 'Alice S.' });
await Http.delete('https://api.example.com/users/1');
```

Every method returns an `HttpResponse` instance — see the [HttpResponse](#httpresponse) section for details.

---

## Fluent Request Builder

Chain builder methods to configure the request before sending:

### Headers

```typescript
const response = await Http.withHeaders({
  Accept: 'application/json',
  'X-Request-ID': crypto.randomUUID(),
}).get('https://api.example.com/users');
```

### Authentication

**Bearer token:**

```typescript
const response = await Http.withToken(accessToken).get('https://api.example.com/me');
```

**Basic auth:**

```typescript
const response = await Http.withBasicAuth('username', 'password').get(
  'https://api.example.com/protected',
);
```

**Digest / custom schemes:**

```typescript
const response = await Http.withHeaders({ Authorization: `Digest ${digestToken}` }).get(
  'https://api.example.com/resource',
);
```

### Base URL

Set a base URL so subsequent calls only need to provide the path:

```typescript
const client = Http.baseUrl('https://api.example.com/v1');

const users = await client.get('/users');
const post = await client.post('/posts', { title: 'Hello World' });
```

This is especially useful when building a reusable API client class:

```typescript
// app/services/GitHubService.ts
import { Injectable, Service } from '@faber-js/core';
import { Http } from '@faber-js/http-client';
import { env } from '@faber-js/config';

@Injectable()
export class GitHubService extends Service {
  private readonly client = Http.baseUrl('https://api.github.com')
    .withToken(env('GITHUB_TOKEN', ''))
    .withHeaders({ 'User-Agent': 'FaberJS-App/1.0' });

  async getUser(login: string) {
    return this.client.get(`/users/${login}`).then((r) => r.json());
  }

  async listRepos(login: string) {
    return this.client.get(`/users/${login}/repos`).then((r) => r.json());
  }
}
```

---

## Timeout and Retry

### Timeout

Abort the request after a specified number of milliseconds:

```typescript
const response = await Http.timeout(5000) // 5 seconds
  .get('https://api.example.com/slow-endpoint');
```

A `RequestTimeoutException` is thrown when the deadline is exceeded.

### Retry

Automatically retry on network errors or `5xx` responses:

```typescript
const response = await Http.retry(3, 500) // 3 attempts, 500ms initial delay
  .get('https://api.example.com/unstable');
```

The delay doubles between attempts (exponential back-off): 500ms → 1000ms → 2000ms.

Combine with timeout for resilient remote calls:

```typescript
const response = await Http.timeout(3000)
  .retry(3, 200)
  .withToken(token)
  .post('https://payments.example.com/charge', payload);
```

---

## Request Body Formats

### JSON (default for POST/PUT/PATCH)

```typescript
await Http.post('/api/data', { key: 'value' });
// Content-Type: application/json
```

### Form data

```typescript
await Http.asForm().post('/submit', {
  username: 'alice',
  password: 'secret',
});
// Content-Type: application/x-www-form-urlencoded
```

### Raw body

```typescript
await Http.withBody('<xml>...</xml>', 'application/xml').post('/webhook');
```

---

## HttpResponse

Every request returns an `HttpResponse` object:

```typescript
const response = await Http.get('https://api.example.com/users');

// Status codes
response.status(); // number — e.g. 200
response.ok(); // true when status is 2xx
response.successful(); // alias for ok()
response.redirect(); // true when status is 3xx
response.clientError(); // true when status is 4xx
response.serverError(); // true when status is 5xx
response.failed(); // true when status is 4xx or 5xx

// Body
const data = await response.json(); // parse JSON body
const text = await response.body(); // raw string
const buffer = await response.buffer(); // ArrayBuffer

// Headers
const type = response.header('Content-Type');
const all = response.headers(); // Record<string, string>
```

---

## Throwing on Failure

### `throw()`

Call `.throw()` on a response to throw an `HttpRequestException` when the status code is 4xx or 5xx:

```typescript
const response = await Http.get('https://api.example.com/users').then((r) => r.throw());
// Equivalent to:
const response = await Http.get('https://api.example.com/users');
response.throw(); // throws HttpRequestException if response.failed()
```

### `throwIf(condition)`

Throw only when a condition is true:

```typescript
const response = await Http.get('https://api.example.com/users');
response.throwIf(response.serverError()); // only throws on 5xx
```

### Error handling

```typescript
import { HttpRequestException } from '@faber-js/http-client';

try {
  const response = await Http.retry(2, 1000).get('https://api.example.com/resource');

  response.throw();

  return response.json();
} catch (err) {
  if (err instanceof HttpRequestException) {
    console.error(`HTTP ${err.response.status()} — ${err.message}`);
  }
  throw err;
}
```

---

## Query Parameters

Pass query string parameters as the second argument to `get()`:

```typescript
const response = await Http.get('https://api.example.com/users', {
  page: 1,
  per_page: 25,
  filter: 'active',
});
// → GET https://api.example.com/users?page=1&per_page=25&filter=active
```

---

## Concurrent Requests

Use `Promise.all` to fire multiple requests in parallel:

```typescript
const [users, posts, tags] = await Promise.all([
  Http.withToken(token)
    .get('/users')
    .then((r) => r.json()),
  Http.withToken(token)
    .get('/posts')
    .then((r) => r.json()),
  Http.withToken(token)
    .get('/tags')
    .then((r) => r.json()),
]);
```

---

## Testing

`Http.fake()` intercepts requests and returns pre-configured stub responses. No network traffic is made during tests.

### Stub a URL

```typescript
import { Http } from '@faber-js/http-client';

beforeEach(() => {
  Http.fake({
    'https://api.example.com/users': Http.response([{ id: 1, name: 'Alice' }], 200),
    'https://api.example.com/users/1': Http.response({ id: 1, name: 'Alice' }, 200),
  });
});
```

### Wildcard stubs

```typescript
Http.fake({
  'https://api.example.com/*': Http.response({ ok: true }, 200),
});
```

### Simulate failure

```typescript
Http.fake({
  'https://payments.example.com/*': Http.response({ error: 'Declined' }, 422),
});
```

### Assertions

```typescript
test('calls the payment API', async () => {
  Http.fake({
    'https://payments.example.com/charge': Http.response({ charged: true }, 200),
  });

  await chargeUser(user, 9900);

  Http.assertSent((request) => {
    return (
      request.url() === 'https://payments.example.com/charge' &&
      request.method() === 'POST' &&
      request.data().amount === 9900
    );
  });
});

test('nothing is sent when the cart is empty', async () => {
  Http.fake();

  await chargeUser(user, 0);

  Http.assertNothingSent();
});
```

### Fake assertion API

| Method                                   | Description                                                        |
| ---------------------------------------- | ------------------------------------------------------------------ |
| `Http.fake(stubs?)`                      | Intercept requests; optional map of URL → stub response            |
| `Http.clearFakes()`                      | Remove all stubs and reset recorded requests (call in `afterEach`) |
| `Http.response(body, status?, headers?)` | Create a stub response                                             |
| `Http.assertSent(callback)`              | Assert a matching request was made                                 |
| `Http.assertNotSent(callback)`           | Assert no matching request was made                                |
| `Http.assertNothingSent()`               | Assert zero requests were sent                                     |
| `Http.assertSentCount(count)`            | Assert exactly `count` requests were sent                          |
| `Http.recorded()`                        | Return all recorded requests                                       |
