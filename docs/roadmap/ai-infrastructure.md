# AI as Infrastructure

**Package:** `@faber-js/ai` (enhanced)  
**Depends on:** `@faber-js/core`, `@faber-js/http`, `@faber-js/auth`, `@faber-js/validation`, `@faber-js/schema`  
**Estimated effort:** 3-4 weeks  
**Priority:** High — open window closes in 12-18 months

---

## Goal

Deepen `@faber-js/ai` so that AI agents are first-class architectural citizens — not wrappers around an HTTP client, but objects that use the same DI container, auth policies, validation rules, and services as the rest of the app. Add AI-enhanced validation and AI-assisted error explanations in development.

---

## Current State

`@faber-js/ai` already provides:

- `Agent` base class with Anthropic SDK integration
- `@Tool` decorator for marking agent methods as tools
- `InMemoryConversationMemory`
- `TokenBudgetMiddleware`
- `AiServiceProvider`

**What's missing:**

- Native DI constructor injection into agents
- Auth policy integration on tools (`@Authorize`)
- Schema-typed tool inputs and outputs
- Structured output via schema declarations
- Streaming from HTTP routes (SSE)
- `Rule.ai()` for AI-powered validation
- AI-explained errors in development

---

## API Enhancements

### 1. Native DI in Agents

Currently agents must manually resolve services. After this, constructor injection works identically to controllers:

```typescript
@Injectable()
export class CustomerSupportAgent extends Agent {
  model = 'claude-opus-4-7';

  constructor(
    private readonly orders: OrderService,
    private readonly payments: PaymentService,
    private readonly users: UserService,
  ) {
    super();
  }

  @Tool({ description: 'Look up order by ID' })
  async getOrder(orderId: string) {
    return this.orders.find(orderId);
  }

  @Tool({ description: 'Issue a full or partial refund' })
  async refund(orderId: string, amount: number, reason: string) {
    const order = await this.orders.find(orderId);
    await this.authorize('refund', order); // uses policy
    return this.payments.refund(orderId, amount, reason);
  }
}
```

The agent is registered like any other service. The container resolves it with all dependencies:

```typescript
// bootstrap/app.ts
app.singleton(CustomerSupportAgent);
```

```typescript
// app/controllers/SupportController.ts
@Injectable()
export class SupportController extends Controller {
  constructor(private readonly agent: CustomerSupportAgent) {
    super();
  }

  async chat(req: Request): Promise<Response> {
    const stream = this.agent.stream(req.input('message'));
    return this.sse(stream);
  }
}
```

### 2. Policy Integration on Tools

```typescript
@Tool({ description: 'Issue a refund' })
@Authorize('refund', (args) => args[0])  // first arg is the resource
async refund(orderId: string): Promise<RefundResult> {
  // only reaches here if the current user can 'refund' orderId
}
```

The `@Authorize` decorator resolves the current HTTP request from `AsyncLocalStorage`, extracts the authenticated user, and runs the policy check before the tool executes. If authorization fails, the agent receives a structured "not authorized" response and can respond appropriately.

### 3. Schema-Typed Tool Inputs

```typescript
const RefundInput = schema({
  orderId: t.string(),
  amount:  t.decimal(10, 2).nullable(),
  reason:  t.enum(['damaged', 'not_received', 'changed_mind']),
});

@Tool({ description: 'Issue a refund', input: RefundInput })
async refund(input: InferSchema<typeof RefundInput>): Promise<void> {
  // input is fully typed and validated before reaching here
}
```

The schema declaration is automatically converted to a JSON Schema for the Anthropic tool definition — no manual JSON Schema writing.

### 4. Structured Output

```typescript
const OrderSummary = schema({
  orderId: t.string(),
  status: t.enum(['pending', 'shipped', 'delivered', 'cancelled']),
  items: t.array(t.object({ name: t.string(), qty: t.integer() })),
  total: t.decimal(10, 2),
});

@Injectable()
export class OrderAnalysisAgent extends Agent {
  model = 'claude-sonnet-4-6';
  output = OrderSummary; // agent MUST return this shape

  async analyze(description: string): Promise<InferSchema<typeof OrderSummary>> {
    return this.chat(description); // typed return guaranteed by output schema
  }
}
```

Uses Anthropic's tool-forcing mechanism to guarantee structured output without prompt engineering.

### 5. HTTP Streaming (SSE)

```typescript
// Controller
async chat(req: Request): Promise<Response> {
  const stream = this.agent.stream(req.input('message'));
  return this.sse(stream);  // new Response helper
}
```

`this.sse()` sets `Content-Type: text/event-stream` and pipes the agent's async generator to the client. Works with the existing Fastify HTTP layer.

Client consumption:

```javascript
const source = new EventSource('/api/support/chat?message=...');
source.onmessage = (e) => {
  const { delta } = JSON.parse(e.data);
  appendToUI(delta);
};
```

### 6. `Rule.ai()` — AI-Powered Validation

```typescript
class CreatePostRequest extends FormRequest {
  rules() {
    return {
      title: ['required', 'string', 'max:200'],
      content: [
        'required',
        'string',
        Rule.ai('Must not contain hate speech, personal information, or spam'),
      ],
    };
  }
}
```

`Rule.ai()` sends the field value to a fast, cheap model (default: `claude-haiku-4-5`) with the rule description as context. Returns pass/fail + a human-readable reason for the failure message.

Configuration:

```typescript
// config/ai.ts
export default {
  validationModel: 'claude-haiku-4-5-20251001', // cheap model for validation
  validationTimeout: 3000, // ms — fail open after this
  failOpen: true, // pass validation if AI is down
};
```

### 7. AI-Explained Errors (Dev Mode)

When `APP_ENV=local`, exceptions thrown during request handling trigger an AI explanation panel in the `/_faber` dashboard and in the CLI output:

```
❌  ModelNotFoundException: No query results for model [User] with ID 999
    UserController@show  ·  app/controllers/UserController.ts:24

🤖  Explanation
    The user with ID 999 doesn't exist in the database. This usually happens when:
    1. The ID comes from a URL parameter that hasn't been validated
    2. The record was deleted but the ID is still being referenced
    3. You're running tests with a seeded database that doesn't include this record

    Suggestion: Add a route model binding for User, or use User.findOrFail(id) to
    get a clear error instead of this exception bubbling up.
```

The explanation is generated once per unique exception + stack trace combination and cached in memory for the session — not on every request.

---

## Multi-Agent Orchestration

For complex workflows, agents can call other agents:

```typescript
@Injectable()
export class ResearchOrchestratorAgent extends Agent {
  model = 'claude-opus-4-7';

  constructor(
    private readonly webSearch: WebSearchAgent,
    private readonly summarizer: SummarizerAgent,
  ) {
    super();
  }

  @Tool({ description: 'Research a topic thoroughly' })
  async research(topic: string) {
    const results = await this.webSearch.search(topic);
    return this.summarizer.summarize(results);
  }
}
```

Sub-agents are DI-resolved. Their tool calls and token usage all roll up into the parent trace in the DevTools dashboard.

---

## Persistent Conversation Memory

Beyond `InMemoryConversationMemory`, add a database-backed implementation:

```typescript
import { DatabaseConversationMemory } from '@faber-js/ai';

@Injectable()
export class SupportAgent extends Agent {
  memory = new DatabaseConversationMemory('support_conversations');
  // Stores conversation history in the 'support_conversations' table
  // Supports per-user session IDs
}
```

`DatabaseConversationMemory` uses the existing ORM connection. The `faber make:agent <Name>` generator creates the migration automatically.

---

## Updated Agent Base Class

```typescript
export abstract class Agent {
  abstract model: string;
  output?: SchemaDefinition; // optional structured output schema
  memory?: ConversationMemory; // optional persistence
  systemPrompt?: string; // optional system prompt

  // Core methods
  async chat(message: string, sessionId?: string): Promise<string>;
  async *stream(message: string, sessionId?: string): AsyncGenerator<string>;

  // Authorization helper (resolves current request user)
  protected async authorize(ability: string, resource?: unknown): Promise<void>;

  // Schema-validated tool invocation (internal)
  private async invokeTool(name: string, input: unknown): Promise<unknown>;
}
```

---

## CLI: `faber make:agent <Name>`

Updated generator that creates:

```typescript
// app/agents/NameAgent.ts
import { Injectable } from '@faber-js/core';
import { Agent, Tool } from '@faber-js/ai';

@Injectable()
export class NameAgent extends Agent {
  model = 'claude-sonnet-4-6';

  @Tool({ description: 'Describe what this tool does' })
  async exampleTool(input: string): Promise<string> {
    return `Processed: ${input}`;
  }
}
```

And registers the agent in `bootstrap/app.ts` automatically.

---

## Package Structure Changes

```
packages/ai/src/
├── index.ts                      — updated exports
├── agent.ts                      — enhanced Agent base class
├── tool.ts                       — @Tool decorator (unchanged)
├── authorize.ts                  — NEW: @Authorize decorator for tools
├── structured-output.ts          — NEW: schema-typed output via tool forcing
├── streaming.ts                  — NEW: SSE streaming helpers
├── rule-ai.ts                    — NEW: Rule.ai() validation rule
├── error-explainer.ts            — NEW: dev-mode error explanations
├── memory.ts                     — InMemoryConversationMemory (unchanged)
├── database-memory.ts            — NEW: DatabaseConversationMemory
├── token-budget-middleware.ts    — unchanged
├── types.ts                      — updated with new types
└── ai-service-provider.ts        — updated registrations
```

---

## Implementation Steps

### Step 1 — DI in Agents (Week 1)

The container already supports constructor injection via `@Injectable`. The change: make `Agent` extend from an injectable-aware base that the container builds correctly. Test with a multi-dependency agent resolving via `app.make(CustomerSupportAgent)`.

### Step 2 — Policy Integration + Schema-Typed Tools (Week 2)

Implement `@Authorize` using `AsyncLocalStorage` for request context. Then implement the schema → JSON Schema converter for tool input definitions.

### Step 3 — Streaming + Rule.ai() (Week 3)

Add `Agent.stream()` as an async generator wrapping Anthropic's streaming API. Add `this.sse()` to the base `Controller` class. Implement `Rule.ai()` with the Haiku model and caching.

### Step 4 — Error Explainer + Database Memory (Week 4)

Integrate the error explainer with the DevTools dashboard. Build `DatabaseConversationMemory` using the ORM, with migration generation.

---

## Testing Plan

- DI resolution: agent with multiple service dependencies resolves correctly
- Policy: `@Authorize` blocks unauthorized tool calls
- Schema types: tool input schema generates correct JSON Schema
- Streaming: SSE response streams chunks correctly
- `Rule.ai()`: valid input passes, invalid input fails with message
- Error explainer: generates explanation for common exception types
- Database memory: conversation history persists and retrieves across agent.chat() calls
