# FaberJS — CLAUDE.md

## What This Is

FaberJS is a full-featured, opinionated Node.js/TypeScript backend framework that mirrors Laravel's developer experience. It targets Laravel developers moving to Node.js who want a unified framework with conventions, a CLI (`faberjs`), routing, ORM, queues, events, and DI — all in one package.

All packages are published under the `/` npm scope. The CLI binary is `faberjs` (Artisan equivalent).

---

## Monorepo Structure

```
faberjs/
├── packages/
│   ├── core/        /core        IoC container, service providers, facades
│   ├── router/      /router       HTTP routing, route groups, model binding
│   ├── orm/         /orm          ActiveRecord ORM, migrations, relationships
│   ├── http/        /http         Request/Response, middleware pipeline
│   ├── console/     /console      Forge CLI (make:*, db:*, queue:*, tinker)
│   ├── queue/       /queue        BullMQ job dispatch and workers
│   ├── events/      /events       Event/Listener bus with queued listeners
│   ├── auth/        /auth         JWT guards and authorization policies
│   ├── config/      /config       .env + typed config file loading
│   ├── validation/  /validation   Rule engine + FormRequest
│   ├── cache/       /cache        Redis and in-memory cache abstraction
│   └── testing/     /testing      HTTP test client + DB assertions
├── create-faberjs/                         npm create faberjs@latest scaffolder
├── stubs/                                  Code generation templates
├── docs/
└── examples/
    ├── api-only/
    └── full-stack/
```

---

## Common Commands

```bash
pnpm install          # install all workspace dependencies
pnpm build            # build all packages (tsup → dist/)
pnpm test             # run all tests with vitest
pnpm test:watch       # vitest watch mode
pnpm test:coverage    # vitest with v8 coverage
pnpm type-check       # tsc --noEmit across all packages
pnpm clean            # delete all dist/ directories
pnpm changeset        # create a new changeset for versioning
```

---

## Tech Stack (Locked In)

| Concern | Choice | Notes |
|---|---|---|
| Runtime | Node.js >= 20 LTS | Bun support post-v1 |
| Language | TypeScript 5.x strict | `experimentalDecorators` + `emitDecoratorMetadata` enabled |
| Decorators | TC39 Stage 3 via `reflect-metadata` | `@Injectable`, `@Inject` for DI |
| HTTP adapter | Fastify (internal) | Never exposed to users; wraps `find-my-way` router |
| ORM transport | Knex (internal) | SQL generation only; users see Eloquent-style API |
| Queue backend | BullMQ + Redis | |
| Auth tokens | JWT via `jose` | |
| Package manager | pnpm workspaces | |
| Test runner | Vitest | globals: true, environment: node |
| Build tool | tsup per package | outputs both CJS (`dist/index.js`) and ESM (`dist/index.mjs`) |
| Versioning | Changesets | `pnpm changeset` → `pnpm version-packages` → `pnpm release` |
| Databases | PostgreSQL (primary), MySQL, SQLite (tests) | |

---

## Architecture Principles

- **IoC Container is the spine.** Everything resolves through `/core`'s container. Service providers register bindings; facades proxy to container-resolved instances. Nothing is a global singleton outside the container.
- **Fastify is an implementation detail.** The `/http` and `/router` packages wrap Fastify completely. User code never imports from Fastify. This keeps the transport layer swappable.
- **Knex is an implementation detail.** The ORM's query builder wraps Knex internally. Users only interact with `Model.where(...).get()` — the underlying SQL dialect adapter is hidden.
- **Middleware is an onion.** The HTTP pipeline processes middleware as a stack (request in → middleware chain → controller → response out). Global middleware is registered in `bootstrap/app.ts`; per-route middleware is registered on the router.
- **FormRequest validates before the controller runs.** Auto-injected FormRequest subclasses are resolved before the controller method is called; validation or authorization failure short-circuits with 422/403.

---

## Build Phases

| Phase | Package(s) | Status | Key Dependency |
|---|---|---|---|
| 1 | Monorepo scaffolding | **Done** | — |
| 2 | `/core`, `/config` | **Done** | Phase 1 |
| 3 | `/http`, `/router` | Not started | Phase 2 |
| 4 | `/orm` | Not started | Phase 2 |
| 5 | `/validation` | Not started | Phase 3 |
| 6 | `/console` | Not started | Phase 2, 4 |
| 7 | `/queue` | Not started | Phase 2, 6 |
| 8 | `/events` | Not started | Phase 2, 7 |
| 9 | `/auth` | Not started | Phase 3, 4, 5 |
| 10 | `/testing`, `create-faberjs` | Not started | All |

---

## Non-Goals (v1.0)

- No view/template engine (API-first; Blade equivalent is post-v1)
- No WebSocket support
- No MongoDB adapter (relational only)
- No multi-tenancy primitives
- No file storage abstraction (S3/local)

---

## Key Files

- `tsconfig.base.json` — root TypeScript config; all packages extend this
- `vitest.config.ts` — unified test runner across all packages
- `pnpm-workspace.yaml` — workspace package declarations
- `.changeset/config.json` — changeset versioning config
- Each package: `tsup.config.ts` controls build output (CJS + ESM + `.d.ts`)
