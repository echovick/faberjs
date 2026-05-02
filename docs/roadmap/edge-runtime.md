# Edge-Native and Bun-Ready

**Package:** `@faber-js/adapters`  
**Depends on:** `@faber-js/core`, `@faber-js/http`, `@faber-js/router`  
**Estimated effort:** 3-5 weeks  
**Priority:** Medium

---

## Goal

Make FaberJS runtime-agnostic. One codebase, multiple deployment targets. The container, routing, ORM, and business logic run unchanged. Only the HTTP I/O layer swaps via a pluggable adapter.

---

## The Problem with Today's Architecture

FaberJS v1.0 is tied to Fastify at the HTTP layer. `@faber-js/http` wraps Fastify's request/response objects. `faber serve` starts a Fastify server. This is fine for traditional deployments but blocks:

- **Bun** — Bun has its own HTTP server (`Bun.serve()`). Running `bun run server.ts` is 4× faster startup than Node + Fastify.
- **AWS Lambda** — Lambda invocations don't start a server. The handler receives a raw event object. Cold start time matters — Fastify's initialization overhead is measurable.
- **Cloudflare Workers** — Workers run in V8 isolates. No Node.js APIs. No Fastify. But the app's routing logic and controller code could run there.
- **Deno Deploy** — Similar constraints to Cloudflare Workers.

---

## Design: Pluggable HTTP Adapter

The adapter interface is the only thing that changes between runtimes. Everything above the adapter (routing, controllers, services, ORM) remains identical.

### Adapter Interface

```typescript
// @faber-js/http
export interface HttpAdapter {
  start(handler: RequestHandler, options: AdapterOptions): Promise<void>;
  stop(): Promise<void>;
}

export interface RequestHandler {
  (request: Request, response: ResponseContext): Promise<Response>;
}

export interface AdapterOptions {
  port?: number;
  host?: string;
}
```

`Request` and `Response` are FaberJS's own classes (already abstracted in `@faber-js/http`). The adapter's job: translate between the runtime's native request/response format and FaberJS's internal format.

### Configuration

```typescript
// faber.config.ts
import { defineConfig } from '@faber-js/core';

export default defineConfig({
  http: {
    adapter: 'fastify', // default
    port: 3000,
    host: '0.0.0.0',
  },
});
```

```typescript
// faber.config.ts (Bun)
export default defineConfig({
  http: {
    adapter: 'bun',
  },
});
```

```typescript
// Lambda: no config needed — detected automatically from environment
// Cloudflare Workers: export syntax signals the adapter
```

---

## Adapters

### 1. Fastify Adapter (Default, Existing)

Extract the current Fastify wiring into `FastifyAdapter`. This is the default and requires no user change. All existing functionality preserved.

```typescript
export class FastifyAdapter implements HttpAdapter {
  private server: FastifyInstance;

  async start(handler: RequestHandler, options: AdapterOptions): Promise<void> {
    this.server = fastify({ logger: false });
    this.server.all('*', async (req, reply) => {
      const faberReq = new Request(req);
      const faberRes = await handler(faberReq, new ResponseContext());
      return sendFastifyResponse(reply, faberRes);
    });
    await this.server.listen({ port: options.port ?? 3000 });
  }
}
```

### 2. Bun Adapter

```typescript
export class BunAdapter implements HttpAdapter {
  private bunServer: ReturnType<typeof Bun.serve> | null = null;

  async start(handler: RequestHandler, options: AdapterOptions): Promise<void> {
    this.bunServer = Bun.serve({
      port: options.port ?? 3000,
      fetch: async (req: globalThis.Request) => {
        const faberReq = new Request(req);
        const faberRes = await handler(faberReq, new ResponseContext());
        return toBunResponse(faberRes);
      },
    });
  }

  async stop(): Promise<void> {
    this.bunServer?.stop();
  }
}
```

Benefits:

- No Fastify startup overhead
- Bun's native HTTP server is ~4× faster at cold starts
- Built-in SQLite (no need for separate SQLite binaries in dev)
- TypeScript runs natively without ts-node

### 3. Lambda Adapter

```typescript
// Installed in the app's Lambda handler
import { createLambdaHandler } from '@faber-js/adapters/lambda';
import app from './bootstrap/app';

export const handler = createLambdaHandler(app);
```

```typescript
export function createLambdaHandler(app: Application) {
  let initialized = false;

  return async (event: APIGatewayEvent, context: Context) => {
    if (!initialized) {
      await app.boot(); // cold start initialization
      initialized = true;
    }

    const faberReq = fromLambdaEvent(event);
    const faberRes = await app.handle(faberReq);
    return toLambdaResponse(faberRes);
  };
}
```

The handler reuses the app instance across warm invocations. Cold start optimization:

- Lazy service provider loading (only boot what's needed for this route)
- No Fastify initialization (direct request handling)
- Target: <50ms cold start for a minimal FaberJS app

### 4. Cloudflare Workers Adapter

```typescript
// worker.ts (deployed to Cloudflare)
import { createWorkerHandler } from '@faber-js/adapters/cloudflare';
import { routes } from './routes/api';

export default createWorkerHandler({ routes });
```

Cloudflare Workers constraints:

- No Node.js built-ins (no `fs`, no `net`, etc.)
- Stateless — no persistent connections
- No Knex/PostgreSQL (use D1 or external API)
- No BullMQ/Redis

The Cloudflare adapter supports a subset of FaberJS: routing, controllers, validation, auth (JWT only), and `@faber-js/ai`. ORM, queue, and events are unavailable — appropriate for edge functions that read from an external API or Cloudflare D1.

---

## Bun-Specific Enhancements

Beyond the HTTP adapter, Bun enables:

### Native SQLite (No `better-sqlite3`)

```typescript
// @faber-js/orm detects Bun and uses Bun.sql for SQLite
const connection = await createConnection({
  client: 'sqlite',
  connection: { filename: './database.sqlite' },
  // When running on Bun: uses Bun.sql automatically
});
```

### `faber serve` with Bun

```bash
faber serve --runtime=bun
# → Uses BunAdapter instead of Fastify
# → ~4× faster startup
# → TypeScript runs natively (no ts-node needed)
```

### `faber.config.ts` Detection

FaberJS detects the runtime automatically:

```typescript
const runtime =
  typeof Bun !== 'undefined' ? 'bun' : process.env.AWS_LAMBDA_FUNCTION_NAME ? 'lambda' : 'node';
```

The appropriate adapter is loaded based on the detected runtime unless explicitly overridden in `faber.config.ts`.

---

## ORM Compatibility

The ORM depends on Knex, which depends on Node.js. For edge runtimes:

| Runtime            | ORM Available | Notes                                    |
| ------------------ | ------------- | ---------------------------------------- |
| Node.js + Fastify  | Full          | PostgreSQL, MySQL, SQLite                |
| Bun                | Full          | All drivers (Bun is Node-compatible)     |
| AWS Lambda         | Full          | PostgreSQL, MySQL via connection pooling |
| Cloudflare Workers | ❌ No         | Use D1 driver (planned) or external API  |
| Deno Deploy        | Partial       | PostgreSQL only, via TCP                 |

A `@faber-js/orm-d1` package will provide Cloudflare D1 support using the same ORM API.

---

## Package Structure

```
packages/adapters/
├── src/
│   ├── index.ts               — exports: createAdapter, detectRuntime
│   ├── fastify/
│   │   ├── fastify-adapter.ts
│   │   └── index.ts
│   ├── bun/
│   │   ├── bun-adapter.ts
│   │   └── index.ts
│   ├── lambda/
│   │   ├── lambda-adapter.ts
│   │   ├── event-bridge.ts    — APIGateway event ↔ FaberJS Request
│   │   └── index.ts
│   ├── cloudflare/
│   │   ├── worker-adapter.ts
│   │   ├── request-bridge.ts  — Web Request API ↔ FaberJS Request
│   │   └── index.ts
│   └── types.ts               — HttpAdapter interface
├── package.json
├── tsup.config.ts
└── tsconfig.json
```

The `@faber-js/http` package is updated to depend on the adapter interface rather than Fastify directly. Fastify becomes a peer dependency.

---

## Migration Path for Existing Apps

No breaking change. The Fastify adapter is the default. Existing apps work without modification.

To switch to Bun:

1. Install Bun
2. Update `faber.config.ts` to set `http: { adapter: 'bun' }`
3. Run `bun run bootstrap/app.ts` instead of `faber serve`

To deploy to Lambda:

1. `pnpm add @faber-js/adapters`
2. Create `lambda.ts` using `createLambdaHandler(app)`
3. Bundle with `esbuild` or `bun build`

---

## Implementation Steps

### Step 1 — Extract Fastify Adapter (Week 1)

Refactor `@faber-js/http` to work with the `HttpAdapter` interface. Move all Fastify-specific code to `FastifyAdapter`. This is the most surgical change — the API surface of `@faber-js/http` must not change.

### Step 2 — Bun Adapter (Week 2)

Implement `BunAdapter` and test with the full app stack. Verify ORM, routing, middleware, and auth all work via Bun's HTTP server.

### Step 3 — Lambda Adapter + Cold Start Optimization (Week 3-4)

Implement `LambdaAdapter`. Profile cold start times and optimize the app boot path. Implement lazy service provider loading for Lambda-specific optimizations.

### Step 4 — Cloudflare Workers Adapter (Week 4-5)

Implement the Workers adapter. This requires identifying which FaberJS packages are compatible with the Workers runtime (no Node APIs) and clearly documenting what's available. Ship a starter template: `create-faberjs --template=cloudflare`.

---

## Testing Plan

- Fastify adapter: existing test suite passes after refactor (regression protection)
- Bun adapter: full app integration test run via `bun test`
- Lambda adapter: mock APIGateway event → FaberJS controller → mock response
- Cloudflare adapter: test with `miniflare` (Cloudflare Workers local emulator)
- Cold start: benchmark Lambda cold start < 50ms with minimal app
- Runtime detection: correct adapter selected without explicit config
