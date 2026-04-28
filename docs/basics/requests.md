# Requests

Every controller method receives a `Request` instance as its first argument. `Request` is immutable — it wraps the incoming HTTP data from Fastify and exposes a clean, Laravel-familiar API.

## Reading input

### `req.all()`

Returns all input data merged from the request body and query string as a plain object.

```typescript
async store(req: Request): Promise<Response> {
  const data = req.all();
  // { name: 'Alice', email: 'alice@example.com', ... }
}
```

### `req.input(key, fallback?)`

Read a single value from body or query string. Returns `undefined` (or the fallback) if the key does not exist.

```typescript
const name = req.input('name'); // unknown
const role = req.input('role', 'user'); // 'user' if not present
```

### `req.only(...keys)`

Returns a new object containing only the specified keys. Useful for mass assignment.

```typescript
const attrs = req.only('name', 'email');
// { name: 'Alice', email: 'alice@example.com' }
```

### `req.except(...keys)`

Returns all input except the specified keys.

```typescript
const safe = req.except('password', 'password_confirmation');
```

### `req.has(key)`

Returns `true` if the key is present in the input data (even if its value is `null`).

```typescript
if (req.has('avatar')) {
  // avatar key was sent
}
```

### `req.filled(key)`

Returns `true` if the key is present and not empty (`null`, `undefined`, or an empty string all return `false`).

```typescript
if (req.filled('bio')) {
  // bio is present and non-empty
}
```

## Route parameters

Route parameters (`:id`, `:slug`, etc.) are accessed with `req.route()`:

```typescript
Route.get('/users/:id/posts/:postId', [PostController, 'show']);

// In the controller:
async show(req: Request): Promise<Response> {
  const userId = req.route('userId');    // string
  const postId = req.route('postId');   // string
}
```

Note: Route parameters are always strings. Cast to `Number()` when you need a numeric ID.

## Headers

### `req.header(key)`

Returns the header value as a string, or `null` if not present. Keys are case-insensitive.

```typescript
const contentType = req.header('content-type');
const accept = req.header('Accept');
const xToken = req.header('X-API-Token');
```

### `req.bearerToken()`

Extracts the token from an `Authorization: Bearer <token>` header. Returns `null` if the header is absent or malformed.

```typescript
const token = req.bearerToken();
if (!token) throw new UnauthorizedException();
```

## Request metadata

```typescript
req.method(); // 'GET', 'POST', 'PUT', ...
req.path(); // '/users/1'
req.url(); // '/users/1?include=posts'
req.ip(); // '127.0.0.1'
req.params(); // all route params as { [key: string]: string }
```

### `req.isJson()`

Returns `true` if the `Content-Type` header contains `application/json`.

```typescript
if (req.isJson()) {
  // body was sent as JSON
}
```

### `req.wantsJson()`

Returns `true` if the `Accept` header includes `application/json` or `*/*`. Useful for content negotiation.

```typescript
if (req.wantsJson()) {
  return this.json(data);
}
```

## The authenticated user

After the `auth` middleware runs, the authenticated user is available via `req.user()`:

```typescript
async profile(req: Request): Promise<Response> {
  const user = req.user();  // AuthUser | null
  return this.json({ data: user });
}
```

The method is generic — pass your own type to get a typed result without a cast:

```typescript
const user = req.user<User>();  // User | null
```

`AuthUser` has `id` (string | number) and a `[key: string]: unknown` index signature for additional fields.

## Validation

For validated input, use `FormRequest` instead of reading `req` directly. See [Validation](/digging-deeper/validation) for details.

```typescript
async store(req: Request): Promise<Response> {
  const form = new CreateUserRequest(req);
  const data = await form.validate();  // throws 422 on failure

  const user = await this.userService.create(data);
  return this.json({ data: user }, 201);
}
```
