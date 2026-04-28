# Authentication

`@faber-js/auth` ships two independent authentication strategies that can be used separately or together:

| Strategy | Guard | Best for |
|---|---|---|
| **JWT** | `JwtGuard` | Stateless APIs, microservices, mobile |
| **API Tokens** | `TokenGuard` | Multi-device sessions, per-token abilities, revocable access |

---

## JWT Authentication

### 1. Create a `UserProvider`

A `UserProvider` bridges the guard to your database — finding users by credentials (login) and by ID (token verification).

```typescript
// app/providers/UserProvider.ts
import type { UserProviderContract } from '@faber-js/auth';
import type { AuthUser } from '@faber-js/http';
import { User } from '../models/User';
import * as bcrypt from 'bcrypt';

export class UserProvider implements UserProviderContract {
  async findByCredentials(credentials: Record<string, unknown>): Promise<AuthUser | null> {
    const user = await User.where<User>('email', credentials['email'] as string).first();
    if (!user) return null;

    const valid = await bcrypt.compare(
      credentials['password'] as string,
      user.getAttribute('password') as string,
    );
    if (!valid) return null;

    return { id: user.getAttribute('id') as number, email: user.getAttribute('email') as string };
  }

  async findById(id: string | number): Promise<AuthUser | null> {
    const user = await User.find<User>(Number(id));
    if (!user) return null;
    return { id: user.getAttribute('id') as number, email: user.getAttribute('email') as string };
  }
}
```

### 2. Register `AuthServiceProvider`

```typescript
// app/providers/AppAuthServiceProvider.ts
import { AuthServiceProvider } from '@faber-js/auth';
import type { AuthConfig, UserProviderContract } from '@faber-js/auth';
import { env } from '@faber-js/config';
import { UserProvider } from './UserProvider';

export class AppAuthServiceProvider extends AuthServiceProvider {
  protected authConfig(): AuthConfig {
    return {
      secret: env('JWT_SECRET', 'change-me'),
      expiresIn: env('JWT_EXPIRES_IN', '7d'),
      algorithm: 'HS256',
    };
  }

  protected userProvider(): UserProviderContract {
    return new UserProvider();
  }
}
```

Register it in `bootstrap/app.ts`:

```typescript
import { AppAuthServiceProvider } from '../app/providers/AppAuthServiceProvider';

app.register(new AppAuthServiceProvider(app));
```

### 3. Use `auth` in routes

`AuthServiceProvider` automatically registers the `auth` middleware — no manual `kernel.register()` call needed. Use it directly in your routes:

```typescript
Route.group({ middleware: ['auth'] }, () => {
  Route.get('/me', [UserController, 'me']);
});
```

### Logging in

```typescript
// app/controllers/AuthController.ts
import { Auth } from '@faber-js/auth';

@Injectable()
export class AuthController extends Controller {
  async login(req: Request): Promise<Response> {
    const token = await Auth.attempt({
      email: req.input('email'),
      password: req.input('password'),
    });

    if (!token) throw new UnauthorizedException('Invalid credentials.');
    return this.json({ token });
  }
}
```

### JWT config reference

| Field | Description | Example |
|---|---|---|
| `secret` | HMAC signing secret | `env('JWT_SECRET')` |
| `expiresIn` | Token TTL in vercel/ms format | `'7d'`, `'24h'`, `'15m'` |
| `algorithm` | Signing algorithm | `'HS256'` (default) |

---

## API Token Authentication

API tokens are stored in your database — each token is named, optionally scoped to abilities, and can be revoked individually. Suitable when users need multiple active sessions (mobile + web + CLI) with different permission levels.

### 1. Run the migration

Create a migration file that re-exports the built-in table definition:

```typescript
// database/migrations/0002_create_personal_access_tokens.ts
import { Migration, Schema } from '@faber-js/orm';

export default class CreatePersonalAccessTokensTable extends Migration {
  async up(): Promise<void> {
    await Schema.create('personal_access_tokens', (table) => {
      table.increments('id');
      table.string('tokenable_type').notNullable();
      table.bigInteger('tokenable_id').notNullable();
      table.string('name').notNullable();
      table.string('token', 64).notNullable().unique();
      table.text('abilities').nullable();
      table.timestamp('last_used_at').nullable();
      table.timestamp('expires_at').nullable();
      table.timestamps();
    });
  }

  async down(): Promise<void> {
    await Schema.dropIfExists('personal_access_tokens');
  }
}
```

```bash
npx faber db:migrate
```

### 2. Register `TokenAuthServiceProvider`

```typescript
// app/providers/AppAuthServiceProvider.ts
import { TokenAuthServiceProvider } from '@faber-js/auth';
import type { TokenConfig, UserProviderContract } from '@faber-js/auth';
import { env } from '@faber-js/config';
import { UserProvider } from './UserProvider';

export class AppAuthServiceProvider extends TokenAuthServiceProvider {
  protected userProvider(): UserProviderContract {
    return new UserProvider();
  }

  // Optional: set a global token TTL
  protected tokenConfig(): TokenConfig {
    return { expiresIn: env('TOKEN_EXPIRES_IN', '90d') };
  }
}
```

### 3. Register the middleware

```typescript
import { TokenMiddleware } from '@faber-js/auth';

kernel.register('auth', new TokenMiddleware());
```

### Issuing tokens

Use `TokenAuth.createToken()` — typically in a login or token-generation controller:

```typescript
import { TokenAuth } from '@faber-js/auth';

@Injectable()
export class TokenController extends Controller {
  async store(req: Request): Promise<Response> {
    // Validate credentials first
    const { email, password, device_name } = req.validated() as Record<string, string>;
    const user = await User.where<User>('email', email).first();
    if (!user || !(await bcrypt.compare(password, user.getAttribute('password') as string))) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const userId = user.getAttribute('id') as number;

    // Issue a scoped token
    const { plainTextToken } = await TokenAuth.createToken(
      userId,
      device_name,
      ['posts:read', 'posts:write'],   // omit for wildcard '*' (all abilities)
    );

    return this.json({ token: plainTextToken }, 201);
  }
}
```

::: warning Show once
`plainTextToken` contains the full `{id}|{secret}` value. Store it in your client — it is **never retrievable** after this response.
:::

### Protecting routes

```typescript
// routes/api.ts
Route.post('/tokens', [TokenController, 'store']);  // public — issues tokens

Route.group({ middleware: ['auth'] }, () => {
  Route.get('/user', [UserController, 'me']);
  Route.delete('/tokens/:id', [TokenController, 'destroy']);
  Route.post('/posts', [PostController, 'store']);
});
```

### Checking abilities

```typescript
import { TokenAuth } from '@faber-js/auth';

async store(req: Request): Promise<Response> {
  if (!TokenAuth.tokenCan(req.user, 'posts:write')) {
    throw new ForbiddenException('Token does not have the posts:write ability.');
  }
  // ...
}
```

`tokenCan()` returns `true` if the token has the specific ability **or** the wildcard `'*'`.

### Revoking tokens

```typescript
@Injectable()
export class TokenController extends Controller {
  // Revoke a specific token (e.g. "log out this device")
  async destroy(req: Request): Promise<Response> {
    const tokenId = Number(req.route('id'));
    await TokenAuth.revokeToken(tokenId);
    return this.noContent();
  }

  // Revoke all tokens (e.g. "log out everywhere" / password changed)
  async destroyAll(req: Request): Promise<Response> {
    await TokenAuth.revokeAllTokens(req.user!.id);
    return this.noContent();
  }
}
```

### Listing tokens

```typescript
async index(req: Request): Promise<Response> {
  const tokens = await TokenAuth.listTokens(req.user!.id);

  return this.json({
    data: tokens.map((t) => ({
      id:           t.getAttribute('id'),
      name:         t.getAttribute('name'),
      abilities:    t.getAbilities(),
      last_used_at: t.getAttribute('last_used_at'),
      created_at:   t.getAttribute('created_at'),
    })),
  });
}
```

### `TokenAuth` API reference

| Method | Description |
|---|---|
| `TokenAuth.createToken(userId, name, abilities?)` | Issue a new token — returns `{ plainTextToken, accessToken }` |
| `TokenAuth.tokenCan(user, ability)` | Check if the request's token has an ability |
| `TokenAuth.revokeToken(tokenId)` | Delete a specific token by DB id |
| `TokenAuth.revokeAllTokens(userId)` | Delete all tokens for a user |
| `TokenAuth.listTokens(userId)` | Fetch all token records for a user |

### Token config reference

| Field | Description | Example |
|---|---|---|
| `expiresIn` | Global TTL applied to every new token | `'90d'`, `'24h'` |

Omit `expiresIn` for non-expiring tokens.

---

## Using both JWT and API tokens

Register each provider separately, binding each guard under its own key:

```typescript
// app/providers/AppAuthServiceProvider.ts
import { ServiceProvider } from '@faber-js/core';
import { JwtGuard, TokenGuard, Gate } from '@faber-js/auth';
import { UserProvider } from './UserProvider';

export class AppAuthServiceProvider extends ServiceProvider {
  register(): void {
    const provider = new UserProvider();

    this.app.singleton('auth.guard',       () => new JwtGuard({ secret: '...', expiresIn: '1h' }, provider));
    this.app.singleton('auth.token.guard', () => new TokenGuard(provider, { expiresIn: '90d' }));
    this.app.singleton('gate',             () => new Gate());
  }
}
```

Then register middleware for each guard:

```typescript
import { AuthMiddleware, TokenMiddleware } from '@faber-js/auth';

kernel.register('auth',       new AuthMiddleware());   // resolves 'auth.guard' → JWT
kernel.register('auth:token', new TokenMiddleware());  // resolves 'auth.token.guard' → DB tokens
```

Use in routes:

```typescript
Route.group({ middleware: ['auth'] },       () => { /* JWT-protected */ });
Route.group({ middleware: ['auth:token'] }, () => { /* token-protected */ });
```

---

## Protecting routes (both strategies)

```typescript
// Single route
Route.get('/profile', [ProfileController, 'show']).middleware(['auth']);

// Group
Route.group({ prefix: '/api', middleware: ['auth'] }, () => {
  Route.get('/users',  [UserController, 'index']);
  Route.post('/users', [UserController, 'store']);
});
```

The middleware reads `Authorization: Bearer <token>`, verifies it against the configured guard, and attaches the user to `req.user`. Missing or invalid tokens throw a `401 UnauthorizedException`.

---

## Authorization — Policies

Policies answer "can this user perform this action on this model?" They work identically regardless of which auth guard is in use.

```typescript
// app/policies/PostPolicy.ts
import { Policy } from '@faber-js/auth';
import type { AuthUser } from '@faber-js/http';
import { Post } from '../models/Post';

export class PostPolicy extends Policy {
  async update(user: AuthUser, post: Post): Promise<boolean> {
    return post.getAttribute('user_id') === user.id;
  }

  async delete(user: AuthUser, post: Post): Promise<boolean> {
    return post.getAttribute('user_id') === user.id;
  }

  // Runs before all other checks — return true to bypass, undefined to continue
  override before(user: AuthUser, _ability: string): boolean | undefined {
    if ((user as { role?: string }).role === 'admin') return true;
    return undefined;
  }
}
```

### Register a policy

```typescript
// In a service provider's boot():
const gate = Application.getInstance().make<Gate>('gate');
gate.registerPolicy(Post, PostPolicy);
```

### Enforce in a controller

```typescript
async update(req: Request): Promise<Response> {
  const post = await Post.findOrFail<Post>(Number(req.route('id')));
  await this.authorize(req.user, 'update', post);   // throws 403 if denied
  await post.update(req.only('title', 'body'));
  return this.json({ data: post });
}
```
