# FaberJS vs AdonisJS — Two Laravel-Inspired Node.js Frameworks Compared

If you're a Laravel developer looking at Node.js, two frameworks speak your language: AdonisJS and FaberJS. Both are explicitly modeled after Laravel. Both have an ORM, a CLI, routing conventions, and a DI system. So what's actually different?

This is a genuine apples-to-apples comparison.

---

## Quick Background

**AdonisJS** has been around since 2015 and is a mature, battle-tested Laravel-inspired framework. v6 (2024) is a TypeScript-first rewrite with a solid ecosystem and a real community. If you want a proven Laravel clone for Node.js, Adonis is the right answer.

**FaberJS** is newer and starts from the same premise — Laravel conventions in Node.js — but pushes further into areas Adonis doesn't cover: AI agents as infrastructure, schema-first models, a frontend bridge protocol, real-time channels, and a v3.0 roadmap that goes well beyond Laravel parity.

---

## Mental Model and Structure

Both frameworks follow the same Laravel-style folder structure:

```
app/
├── controllers/
├── models/
├── services/
├── jobs/
└── events/
routes/
database/migrations/
```

If you've used one, the folder layout of the other is immediately familiar. No surprises here.

---

## Routing

**AdonisJS:**

```typescript
// start/routes.ts
router.get('/posts', [PostController, 'index']);
router.post('/posts', [PostController, 'store']);
router.resource('posts', PostController);
```

**FaberJS:**

```typescript
// routes/api.ts
Route.get('/posts', [PostController, 'index']);
Route.post('/posts', [PostController, 'store']);
Route.resource('posts', PostController);
```

Nearly identical. Both support route groups, middleware, named routes, and model binding. This is intentional — both are modeling Laravel's router.

---

## ORM

Both ship an Eloquent-style ActiveRecord ORM.

**AdonisJS (Lucid):**

```typescript
const posts = await Post.query()
  .where('published', true)
  .orderBy('createdAt', 'desc')
  .paginate(page, 15);

const post = await Post.create({ title, body, userId });
await post.merge({ published: true }).save();
```

**FaberJS:**

```typescript
const posts = await Post.where('published', true).orderBy('created_at', 'desc').paginate(15);

const post = await Post.create({ title, body, user_id });
await post.update({ published: true });
```

Both support relationships (`hasMany`, `belongsTo`, `manyToMany`), eager loading, and migrations. Lucid is more mature with broader edge case coverage. FaberJS's ORM has the cleaner query API but is newer.

---

## CLI

Both have an Artisan-equivalent CLI.

| Command                    | AdonisJS (Ace)                  | FaberJS (faber)                      |
| -------------------------- | ------------------------------- | ------------------------------------ |
| Generate controller        | `node ace make:controller Post` | `npx faber make:controller Post`     |
| Generate model + migration | `node ace make:model Post -m`   | `npx faber make:model Post -m`       |
| Generate service           | No built-in                     | `npx faber make:service PostService` |
| Generate AI agent          | No                              | `npx faber make:agent SupportAgent`  |
| Run migrations             | `node ace migration:run`        | `npx faber db:migrate`               |
| Interactive REPL           | `node ace repl`                 | `npx faber tinker`                   |
| List routes                | `node ace list:routes`          | `npx faber route:list`               |

FaberJS adds `make:service` and `make:agent` — Adonis doesn't have built-in service generation or any AI agent tooling.

---

## Authentication

**AdonisJS:** Ships `@adonisjs/auth` with session-based, API token, and basic auth guards. Mature, well-documented, supports multiple drivers.

**FaberJS:** Ships `@faber-js/auth` with JWT guards, API tokens, authorization policies, and password reset. Also scaffolds the full auth flow at project creation (`npm create faberjs@latest` → include auth).

Both are solid. Adonis has more guard types. FaberJS's password reset is included in v1.1.

---

## Built-in Ecosystem Comparison

| Feature             | AdonisJS v6             | FaberJS v1.1                 |
| ------------------- | ----------------------- | ---------------------------- |
| ORM                 | Lucid (ActiveRecord)    | Built-in (ActiveRecord)      |
| Auth                | `@adonisjs/auth`        | Built-in                     |
| Validation          | VineJS                  | Built-in (rule engine)       |
| Mail                | `@adonisjs/mail`        | Built-in                     |
| Cache               | No built-in             | Built-in (Redis/memory/DB)   |
| Queues              | No built-in             | Built-in (BullMQ)            |
| Events              | Emittery-based          | Built-in                     |
| HTTP client         | No built-in             | Built-in (Http.fake())       |
| Encryption/Hashing  | `@adonisjs/core`        | Built-in (`@faber-js/crypt`) |
| Real-time channels  | No built-in             | Built-in                     |
| Schema-first models | No                      | Built-in                     |
| Frontend bridge     | No (Inertia via plugin) | Built-in                     |
| AI agents           | No                      | Built-in                     |
| Collections/Str/Arr | No                      | Built-in                     |

The gap to watch: **queues and cache**. AdonisJS has no built-in queue solution — you'd add BullMQ yourself. FaberJS includes both out of the box.

---

## AI Agents — The Key Differentiator

This is where the two frameworks diverge most clearly. AdonisJS has no agent story. You'd integrate an SDK externally and manage it yourself.

FaberJS ships `@faber-js/ai` as a first-class framework package:

```bash
npx faber make:agent SummaryAgent
```

```typescript
@Injectable()
export class SummaryAgent extends Agent {
  protected model = 'claude-3-5-sonnet-latest';
  protected systemPrompt = 'Summarize blog posts concisely.';

  @Tool({ description: 'Fetch a post from the database' })
  async getPost(id: number) {
    return Post.where('id', id).first();
  }
}
```

```typescript
// Call it from any controller — the container wires it
@Injectable()
export class PostController extends Controller {
  constructor(
    private readonly posts: PostService,
    private readonly summary: SummaryAgent,
  ) {
    super();
  }

  async show(req: Request): Promise<Response> {
    const post = await this.posts.find(Number(req.params.id));
    const tldr = await this.summary.chat(`Summarize post ${post.id}`);
    return this.json({ post, tldr });
  }
}
```

The agent is just a class. The container resolves it. It has access to your models, services, and jobs like any other component.

---

## Schema-First Models

AdonisJS uses standard TypeScript decorators on model classes. FaberJS ships `@faber-js/schema` — a schema-first model definition layer with full type inference:

```typescript
// Define the schema once
const PostSchema = s.model('posts', {
  id: s.increments(),
  title: s.string(),
  body: s.text(),
  published: s.boolean().default(false),
  userId: s.integer().references('users.id'),
  createdAt: s.timestamp(),
});

// Type inference is automatic — no separate interface needed
type Post = InferModel<typeof PostSchema>;
```

The schema drives the migration, the model, and the TypeScript types from a single source of truth.

---

## Maturity and Community

**AdonisJS wins here.** It's been in production since 2015, has thousands of GitHub stars, an active Discord, documented third-party packages, and real-world deployments at scale. If community size and production track record are your priority, Adonis is the safer bet today.

**FaberJS** is newer. The framework is complete and v1.1 is production-ready, but the community is still forming. What FaberJS offers in return is a cleaner API, a more complete built-in ecosystem, and features Adonis doesn't plan to ship — AI agents, schema-first models, and a frontend bridge protocol.

---

## When to Choose AdonisJS

- You need a proven, battle-tested framework with years of production use
- Community size and third-party package availability matter for your project
- You want the most mature ORM in the Laravel-for-Node space (Lucid)
- Your team wants session-based auth with multiple guard types

## When to Choose FaberJS

- You want the full Laravel ecosystem equivalent in one install (queues, cache, mail, events all built in)
- You're building AI-powered backends and want agents as first-class infrastructure
- You want schema-first model definitions with automatic type inference
- You want real-time channels, a frontend bridge, and a broader v2/v3 roadmap
- You're starting fresh and want the cleaner, more modern API

---

## The Honest Summary

AdonisJS is what you choose when you need Laravel conventions _today_ and want a community that's been there before you. FaberJS is what you choose when you want the complete ecosystem — including AI infrastructure — and you're building for what backend development looks like in 2026 and beyond.

Both are the right answer to "I want Laravel conventions in Node.js." They just disagree on how far to take it.

**Try FaberJS:** `npm create faberjs@latest`  
**GitHub:** https://github.com/echovick/faberjs  
**Docs:** https://faberjs.dev
