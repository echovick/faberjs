# Dev Observability Dashboard

**Package:** `@faber-js/devtools`  
**Depends on:** `@faber-js/core`, `@faber-js/http`, `@faber-js/router`, `@faber-js/orm`, `@faber-js/queue`, `@faber-js/events`  
**Estimated effort:** 3-4 weeks  
**Priority:** High

---

## Goal

A zero-config development dashboard at `/_faber` that shows every request, query, job, event, and AI agent trace in real time. In production, the same instrumentation emits structured logs and OpenTelemetry spans with no extra setup.

---

## Dashboard Panels

### Panel 1 — Request Trace

Live feed of every HTTP request processed by the app.

| Column     | Description           |
| ---------- | --------------------- |
| Method     | GET / POST / etc.     |
| Path       | `/api/users/42`       |
| Controller | `UserController@show` |
| Status     | 200 / 404 / 500       |
| Time       | 23ms                  |
| Queries    | 3 SQL queries         |
| Memory     | +1.2MB                |

Click any row to expand:

- Full request headers and body
- Full response headers and body
- SQL queries in order with timing and the calling code location
- Middleware chain with time per middleware
- Exceptions thrown (with stack trace, even if caught)

### Panel 2 — Job Queue

Live view of the BullMQ queue.

**Pending tab:** Job class, payload preview, scheduled time, attempt count  
**Running tab:** Same + elapsed time, current step (for multi-step jobs)  
**Failed tab:** Job class, error message, full stack trace, payload, retry button  
**Completed tab:** Recent completions with timing

Click any job for full payload inspection and attempt history.

### Panel 3 — Event Bus

Chronological log of all events fired.

| Time         | Event            | Listeners   | Duration |
| ------------ | ---------------- | ----------- | -------- |
| 14:23:01.442 | `UserRegistered` | 3 listeners | 45ms     |
| 14:23:01.387 | `OrderPaid`      | 2 listeners | 12ms     |

Expand each event to see which listeners ran, their individual timing, and whether any were queued async.

### Panel 4 — Model Browser

Live introspection of your database models.

- Table list with row count
- Click any table: recent 50 records in a data grid
- Query log: last 100 SQL statements with timing
- Slow query alert: any query over configurable threshold (default 100ms) highlighted

### Panel 5 — AI Agent Traces

Full tool call chains for every agent invocation.

```
CustomerSupportAgent.chat (2.3s total)
  ├── Tool: orderStatus("ORD-123")  →  { status: "shipped" }  [45ms]
  ├── Tool: getShippingInfo("ORD-123")  →  { carrier: "FedEx", eta: "Tomorrow" }  [38ms]
  └── Response generated  [1.8s, 847 tokens]
```

- Input message, full response
- Token usage per step (prompt + completion)
- Tool inputs and outputs (full JSON)
- Total cost estimate (configurable per-model pricing)

---

## API Design

### Registering DevTools

```typescript
// bootstrap/app.ts
import { createApp } from '@faber-js/core';
import { DevToolsServiceProvider } from '@faber-js/devtools';

const app = createApp({
  providers: [
    // ...other providers
    DevToolsServiceProvider, // only active when APP_ENV !== 'production'
  ],
});
```

Or automatically enabled in the scaffolded app when `APP_ENV=local`.

### Configuration

```typescript
// config/devtools.ts
export default {
  enabled: process.env.APP_ENV !== 'production',
  path: '/_faber', // dashboard URL
  slowQueryThreshold: 100, // ms — highlight slow queries
  maxEvents: 500, // events to keep in memory ring buffer
  maxRequests: 200, // requests to keep in memory ring buffer
};
```

### Programmatic Access

```typescript
import { DevTrace } from '@faber-js/devtools';

// Add a custom span to the current request trace
DevTrace.span('cache:get', { key: 'user:42' }, async () => {
  return await cache.get('user:42');
});
```

---

## Architecture

### Instrumentation Layer

Instrumentation is injected at the service provider level. Each package exposes hooks that DevTools subscribes to:

**HTTP layer** — middleware added automatically at position 0 in the pipeline, records start time, captures request/response, fires after response is sent (non-blocking).

**ORM layer** — `connection.on('query', handler)` and `connection.on('query-response', handler)` via Knex's built-in event system. Attached when DevTools is active.

**Queue layer** — BullMQ global events listener (`queue.on('completed')`, `queue.on('failed')`, etc.).

**Event layer** — wraps the event dispatcher to record each `event()` call and its listener results.

**AI layer** — wraps `Agent.chat()` to record the full tool call trace.

All instrumentation is conditional: it only activates when `DevToolsServiceProvider` is registered.

### Storage (Ring Buffer)

Traces are kept in an in-memory ring buffer — no database writes, no disk I/O. Default capacity:

- 200 request traces
- 500 SQL queries (across all requests)
- 500 job events
- 500 event bus entries
- 100 AI agent traces

Once capacity is reached, the oldest entry is evicted. All of this is configurable.

### Dashboard Server

The dashboard is served by the existing Fastify instance. `DevToolsServiceProvider` registers these routes at boot time:

```
GET  /_faber                → HTML shell (single-page app)
GET  /_faber/api/requests   → JSON: recent requests
GET  /_faber/api/jobs       → JSON: queue state
GET  /_faber/api/events     → JSON: event log
GET  /_faber/api/queries    → JSON: SQL query log
GET  /_faber/api/agents     → JSON: AI agent traces
GET  /_faber/ws             → WebSocket: live push updates
```

The dashboard UI is a minimal React app bundled into the package — no build step required by the user. The UI is served inline as a base64-embedded JS/CSS bundle to keep it zero-config.

### Live Updates

The dashboard uses a WebSocket connection (`/_faber/ws`) for live updates. When a new request, job event, or agent trace is recorded, it's pushed to all connected dashboard clients in real time.

---

## Production Mode

When `APP_ENV=production`, the dashboard routes are never registered. But the instrumentation layer remains active and emits:

### Structured JSON Logs

```json
{
  "time": "2024-01-15T14:23:01.442Z",
  "level": "info",
  "type": "http.request",
  "method": "POST",
  "path": "/api/orders",
  "controller": "OrderController@store",
  "status": 201,
  "duration_ms": 23,
  "sql_queries": 3,
  "sql_duration_ms": 8
}
```

### OpenTelemetry Spans

When `OTEL_EXPORTER_OTLP_ENDPOINT` is set, traces are automatically exported as OpenTelemetry spans. Works out of the box with Datadog, Grafana Tempo, Honeycomb, and any OTLP-compatible backend.

```typescript
// No configuration needed — just set the env var
OTEL_EXPORTER_OTLP_ENDPOINT=https://otel.datadoghq.com
```

---

## Package Structure

```
packages/devtools/
├── src/
│   ├── index.ts                  — exports: DevToolsServiceProvider, DevTrace
│   ├── devtools-service-provider.ts
│   ├── trace-store.ts            — in-memory ring buffer
│   ├── instrumentation/
│   │   ├── http-tracer.ts        — middleware that records requests
│   │   ├── orm-tracer.ts         — Knex query event listener
│   │   ├── queue-tracer.ts       — BullMQ event listener
│   │   ├── event-tracer.ts       — event dispatcher wrapper
│   │   └── ai-tracer.ts          — agent call wrapper
│   ├── server/
│   │   ├── dashboard-routes.ts   — /_faber route registrations
│   │   ├── websocket-handler.ts  — live push
│   │   └── api-handlers.ts       — JSON API for dashboard
│   ├── ui/
│   │   └── bundle.ts             — embedded dashboard UI (built separately)
│   ├── production/
│   │   ├── json-logger.ts        — structured log emitter
│   │   └── otel-exporter.ts      — OpenTelemetry span exporter
│   └── types.ts
├── ui-src/                       — React dashboard source (built to ui/bundle.ts)
│   ├── App.tsx
│   ├── panels/
│   │   ├── RequestPanel.tsx
│   │   ├── JobPanel.tsx
│   │   ├── EventPanel.tsx
│   │   ├── ModelPanel.tsx
│   │   └── AgentPanel.tsx
│   └── vite.config.ts
├── package.json
├── tsup.config.ts
└── tsconfig.json
```

---

## Implementation Steps

### Step 1 — Trace Store + HTTP Tracer (Week 1)

Build the ring buffer and the HTTP middleware. This is the highest-value instrumentation — every request is captured with timing, queries, and middleware chain. Verify the `/_faber` route serves static content.

### Step 2 — ORM + Queue + Event Tracers (Week 2)

Wire up the remaining tracers. ORM tracer correlates SQL queries back to the originating HTTP request via `AsyncLocalStorage` — the same mechanism Node.js uses for request-scoped context.

### Step 3 — Dashboard UI (Week 3)

Build the React dashboard. Keep it simple: tabs, a data table per panel, expandable rows. No external UI library — just Tailwind CSS bundled in. The dashboard source lives in `ui-src/` and the build output is committed to `src/ui/bundle.ts` as an embedded string.

### Step 4 — AI Tracer + Production Mode (Week 4)

Add the AI agent tracer. Then implement the production JSON logger and the optional OTEL exporter.

---

## Testing Plan

- Integration test: register DevToolsServiceProvider, make HTTP request, verify trace in store
- ORM tracer: run query, verify it appears correlated to request
- Queue tracer: dispatch job, verify state transitions captured
- Dashboard routes: verify `/_faber` returns 200 in dev, 404 in production
- Ring buffer: fill to capacity, verify eviction order
