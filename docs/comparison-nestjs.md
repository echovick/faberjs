# FaberJS vs NestJS — Choosing a Node.js Backend Framework

NestJS is the most popular structured Node.js framework. FaberJS is newer and takes a different philosophical position. This article breaks down the real differences so you can make an informed choice.

---

## The Core Philosophical Difference

**NestJS** is built around the Angular mental model — modules, providers, decorators, and explicit dependency graphs. It brings order to Node.js by borrowing enterprise Java and Angular patterns.

**FaberJS** is built around the Laravel mental model — convention over configuration, a predictable folder structure, a full ecosystem out of the box, and a CLI that generates everything. It asks: _what would a Laravel developer expect here?_

These are genuinely different philosophies, not just surface-level API differences.

---

## Setup and First Impressions

**NestJS:**

```bash
npm install -g @nestjs/cli
nest new my-api
```

You get a module-based scaffold. Adding a resource means creating a module, a controller, a service, a DTO, and wiring them into the module's `providers` and `controllers` arrays.

**FaberJS:**

```bash
npm create faberjs@latest my-api
cd my-api && pnpm install && npx faber serve
```

You get a running server with routing, DI, ORM, migrations, auth, and queues. Adding a resource:

```bash
npx faber make:controller PostController
npx faber make:service PostService
npx faber make:model Post -m
```

No wiring required. The container discovers them automatically.

---

## Routing

**NestJS:**

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([Post])],
  controllers: [PostController],
  providers: [PostService],
})
export class PostModule {}

@Controller('posts')
export class PostController {
  constructor(private readonly posts: PostService) {}

  @Get()
  findAll() {
    return this.posts.findAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe())
  create(@Body() dto: CreatePostDto) {
    return this.posts.create(dto);
  }
}
```

Every route lives inside a class, decorated per-method. The module must be declared and imported.

**FaberJS:**

```typescript
// routes/api.ts — one place for all routes
Route.group({ prefix: '/api', middleware: ['auth'] }, () => {
  Route.resource('posts', PostController);
});

// app/controllers/PostController.ts
@Injectable()
export class PostController extends Controller {
  constructor(private readonly posts: PostService) {
    super();
  }

  async index(_req: Request): Promise<Response> {
    return this.json(await this.posts.all());
  }

  async store(req: Request): Promise<Response> {
    const data = req.validate({ title: ['required', 'string'], body: ['required', 'string'] });
    return this.json(await this.posts.create(data), 201);
  }
}
```

Routes are declared separately in `routes/api.ts`. Controllers are plain classes. No module declarations.

---

## ORM

**NestJS** has no built-in ORM. You choose one:

- TypeORM (most common, but decorator-heavy and has rough edges with TypeScript)
- Prisma (schema-first, separate DSL, requires codegen)
- Drizzle (lightweight, SQL-first)
- MikroORM

Each requires its own setup, its own module import, and its own migration tooling.

**FaberJS** ships `@faber-js/orm` — an Eloquent-style ActiveRecord ORM backed by Knex:

```typescript
// No setup. Just use it.
const posts = await Post.where('published', true)
  .orderBy('created_at', 'desc')
  .with('user')
  .paginate(15);

const post = await Post.create({ title, body, user_id });
await post.update({ published: true });
await post.delete();
```

Migrations are generated with `faber make:migration` and run with `faber db:migrate`. No external tools.

---

## Queues and Events

**NestJS:**

```bash
npm install @nestjs/bull bull
```

Then register a `BullModule`, create a `@Processor`, add it to a module's providers. Events require `@nestjs/event-emitter` separately.

**FaberJS:**

```typescript
// Built in. No setup.
await dispatch(new SendWelcomeEmail(user));
await event(new UserRegistered(user));
```

`@faber-js/queue` (BullMQ) and `@faber-js/events` are part of the core ecosystem. The `dispatch()` and `event()` globals are available everywhere.

---

## Authentication

**NestJS:** Install `@nestjs/passport`, `passport`, `passport-jwt`, `@nestjs/jwt`. Configure `PassportModule`, `JwtModule`, write a `JwtStrategy`, create `AuthModule`, import it everywhere.

**FaberJS:** Auth is scaffolded at project creation. Add `middleware: ['auth']` to any route group. The guard, JWT verification, and `req.user()` accessor are wired already.

---

## Built-in Ecosystem Comparison

| Feature             | NestJS                                  | FaberJS           |
| ------------------- | --------------------------------------- | ----------------- |
| ORM                 | Third-party (TypeORM/Prisma/Drizzle)    | Built-in          |
| Auth                | Passport (manual setup)                 | Built-in          |
| Queues              | `@nestjs/bull` (extra install)          | Built-in (BullMQ) |
| Events              | `@nestjs/event-emitter` (extra)         | Built-in          |
| Cache               | `@nestjs/cache-manager` (extra)         | Built-in          |
| Mail                | Third-party (Nodemailer setup)          | Built-in          |
| Validation          | `class-validator` + `class-transformer` | Built-in          |
| HTTP client         | `axios` or `fetch` (manual)             | Built-in          |
| CLI generators      | `nest generate` (limited)               | Full `faber` CLI  |
| AI agents           | Third-party                             | Built-in          |
| Real-time channels  | Third-party (Socket.io setup)           | Built-in          |
| Schema-first models | No                                      | Built-in          |

---

## AI Agents

This is where FaberJS has no competition. NestJS has no native agent story — you'd integrate LangChain, Vercel AI SDK, or a raw SDK yourself.

FaberJS ships `@faber-js/ai`:

```bash
npx faber make:agent SupportAgent
```

```typescript
@Injectable()
export class SupportAgent extends Agent {
  protected model = 'claude-3-5-sonnet-latest';

  @Tool({ description: 'Look up user account' })
  async lookupUser(email: string) {
    return User.where('email', email).first();
  }
}
```

The agent is injectable into any controller or job. The container resolves it. No configuration.

---

## When to Choose NestJS

- You're coming from an Angular or Spring Boot background
- You want strict module boundaries enforced by the framework
- You need maximum ecosystem compatibility (NestJS has a large third-party package ecosystem)
- Your team is large and you want explicit, verbose wiring as documentation
- You're building a microservices architecture with gRPC, Kafka, or NATS

## When to Choose FaberJS

- You know Laravel and want those conventions in Node.js
- You're assembling the same Express/Fastify stack repeatedly and want it to stop
- You want a complete ecosystem without choosing and integrating each piece
- You're building AI-powered backends and want agents as infrastructure
- You want a CLI that generates everything and a framework with one obvious way to do things

---

## Summary

NestJS gives you structure. FaberJS gives you conventions. Both solve the "Node.js is unstructured" problem, but from opposite directions — NestJS by adding explicit module boundaries, FaberJS by encoding the right way to build things into the framework itself.

If you've ever wished Node.js had a Laravel, FaberJS is the answer. If you want Angular patterns on the backend, NestJS is mature and proven.

**Try FaberJS:** `npm create faberjs@latest`  
**GitHub:** https://github.com/echovick/faberjs  
**Docs:** https://faberjs.dev
