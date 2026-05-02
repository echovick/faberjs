# Real-Time Channels

**Package:** `@faber-js/channels`  
**Depends on:** `@faber-js/core`, `@faber-js/http`, `@faber-js/router`, `@faber-js/auth`, `@faber-js/schema`  
**Estimated effort:** 4-6 weeks  
**Priority:** Medium — after schema-first and AI infra

---

## Goal

First-class WebSocket channels that feel like HTTP routes. Same DI container, same middleware pipeline, same auth guards, same service injection — just over a persistent connection. A global `broadcast()` function that works from anywhere in the app.

---

## API Design

### Channel Registration

```typescript
// routes/channels.ts
import { Channel } from '@faber-js/channels';

Channel.private('user.{id}', [AuthMiddleware], [UserChannel, 'presence']);
Channel.public('notifications', [NotificationChannel, 'subscribe']);
Channel.presence('room.{slug}', [AuthMiddleware], [RoomChannel, 'join']);
```

**Channel types:**

- `Channel.public()` — Anyone can connect, no auth required
- `Channel.private()` — Auth middleware required, one user per channel
- `Channel.presence()` — Auth required, tracks all connected members, exposes member list

### Channel Classes

```typescript
// app/channels/UserChannel.ts
import { Injectable } from '@faber-js/core';
import { Channel, Socket } from '@faber-js/channels';

@Injectable()
export class UserChannel extends Channel {
  constructor(private readonly users: UserService) {
    super();
  }

  async presence(socket: Socket, userId: string): Promise<void> {
    // Fires when a client connects to 'user.{userId}'
    const user = await this.users.find(userId);
    socket.join(`user.${userId}`);
    socket.emit('connected', { user });

    socket.on('ping', () => {
      socket.emit('pong', { time: Date.now() });
    });

    socket.on('disconnect', () => {
      // cleanup
    });
  }
}
```

```typescript
// app/channels/RoomChannel.ts
@Injectable()
export class RoomChannel extends Channel {
  async join(socket: Socket, slug: string): Promise<void> {
    const room = await Room.where('slug', slug).firstOrFail();
    const user = socket.user(); // resolved from auth middleware

    socket.joinPresence(`room.${slug}`, {
      id: user.id,
      name: user.name,
      avatar: user.avatar,
    });

    socket.on('message', async (content: string) => {
      const message = await Message.create({
        roomId: room.id,
        userId: user.id,
        content,
      });
      socket.to(`room.${slug}`).emit('message', message);
    });
  }
}
```

### Broadcasting from Anywhere

```typescript
import { broadcast } from '@faber-js/channels';

// Broadcast to everyone on a channel
await broadcast('notifications', 'new-post', { postId: 42 });

// Broadcast to a specific user's private channel
await broadcast(`user.${userId}`, 'order.updated', { orderId: 99 });

// Broadcast to a room channel
await broadcast(`room.${slug}`, 'member.joined', { user: { id, name } });
```

```typescript
// Or from any model/service naturally
class OrderService {
  async markShipped(orderId: number): Promise<void> {
    const order = await Order.findOrFail(orderId);
    order.status = 'shipped';
    await order.save();

    await broadcast(`user.${order.userId}`, 'order.shipped', {
      orderId: order.id,
      trackingNumber: order.trackingNumber,
    });
  }
}
```

### Typed Events (with Schema integration)

```typescript
// schema/events/OrderShipped.ts
export const OrderShippedEvent = schema({
  orderId: t.integer(),
  trackingNumber: t.string(),
  carrier: t.string(),
  estimatedDate: t.date(),
});

// Broadcasting with schema enforcement
await broadcast(`user.${userId}`, 'order.shipped', {
  orderId: 99,
  trackingNumber: 'FX-123',
  carrier: 'FedEx',
  estimatedDate: new Date('2024-02-01'),
});
// TypeScript enforces the shape via InferSchema<typeof OrderShippedEvent>
```

---

## Client-Side Integration

### With `@faber-js/bridge-react`

```typescript
// React component
import { useChannel, usePresence } from '@faber-js/bridge-react';

function OrderTracker({ orderId }: { orderId: number }) {
  const [status, setStatus] = useState('pending');

  useChannel(`user.${currentUser.id}`, {
    'order.shipped': ({ trackingNumber }) => {
      setStatus('shipped');
      showNotification(`Shipped! Tracking: ${trackingNumber}`);
    },
  });

  return <div>Order status: {status}</div>;
}
```

```typescript
// Presence channel
function ChatRoom({ slug }: { slug: string }) {
  const { members, emit } = usePresence(`room.${slug}`);

  return (
    <div>
      <MemberList members={members} />
      <ChatInput onSend={(msg) => emit('message', msg)} />
    </div>
  );
}
```

### With `@faber-js/bridge-vue`

```typescript
import { useChannel } from '@faber-js/bridge-vue';

const { on } = useChannel(`user.${user.id}`);
on('order.shipped', ({ trackingNumber }) => {
  toast(`Your order shipped! Track it: ${trackingNumber}`);
});
```

### Vanilla JS Client

```javascript
import { FaberChannels } from '@faber-js/channels/client';

const channels = new FaberChannels({ url: 'ws://localhost:3000' });

const userChannel = channels.private(`user.${userId}`);
userChannel.listen('order.shipped', (data) => {
  console.log('Shipped!', data);
});

const room = channels.presence(`room.${slug}`);
room.here((members) => console.log('Connected members:', members));
room.joining((member) => console.log('Joined:', member));
room.leaving((member) => console.log('Left:', member));
```

---

## Architecture

### WebSocket Transport

Uses `@fastify/websocket` (already compatible with Fastify v5). The channel route registration adds a WebSocket route under a single path (e.g., `/_faber/ws`). Channel name resolution happens via the initial handshake message.

Connection flow:

1. Client opens WebSocket to `/_faber/ws`
2. Client sends `{ type: 'subscribe', channel: 'user.42', token: '...' }`
3. Server resolves channel, runs middleware, calls the channel handler method
4. Handler receives `Socket` object, registers event listeners
5. Bidirectional messaging begins

### Socket Class

```typescript
class Socket {
  // Channel operations
  join(channel: string): void
  joinPresence(channel: string, memberData: Record<string, unknown>): void
  leave(channel: string): void

  // Messaging
  emit(event: string, data: unknown): void
  to(channel: string): { emit(event: string, data: unknown): void }
  broadcast(event: string, data: unknown): void  // to all except self

  // Event listening
  on(event: string, handler: (data: unknown) => void): void

  // Auth integration
  user<T = unknown>(): T  // resolved from auth middleware

  // Lifecycle
  on('disconnect', handler: () => void): void
  disconnect(): void
}
```

### Broadcasting Backend

The `broadcast()` global uses an event emitter that the WebSocket handler subscribes to. In a single-process setup, this is just an in-memory `EventEmitter`.

For multi-process or multi-server deployments, configure a Redis adapter:

```typescript
// config/channels.ts
export default {
  driver: process.env.CHANNELS_DRIVER ?? 'memory', // 'memory' | 'redis'
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379'),
    channel: 'faberjs_channels', // Redis pub/sub channel name
  },
};
```

When `driver: 'redis'`, the `broadcast()` function publishes to Redis pub/sub. All server instances subscribe and forward to their locally-connected WebSocket clients.

---

## Presence Channels

Presence channels track connected members and expose them to all participants.

```typescript
// The presence data is whatever you pass to joinPresence()
socket.joinPresence(`room.${slug}`, {
  id: user.id,
  name: user.name,
  role: user.role,
  joinedAt: new Date(),
});
```

All connected clients automatically receive:

- `presence.init` — the full member list on connection
- `presence.joined` — when a new member connects
- `presence.left` — when a member disconnects

The `PresenceStore` keeps the member list in memory (or Redis in multi-process mode).

---

## CLI: `faber make:channel <Name>`

Generates:

```typescript
// app/channels/NameChannel.ts
import { Injectable } from '@faber-js/core';
import { Channel, Socket } from '@faber-js/channels';

@Injectable()
export class NameChannel extends Channel {
  async handle(socket: Socket): Promise<void> {
    socket.on('disconnect', () => {
      // cleanup
    });
  }
}
```

And adds the channel route to `routes/channels.ts`.

---

## Package Structure

```
packages/channels/
├── src/
│   ├── index.ts                    — server exports
│   ├── client.ts                   — browser client bundle
│   ├── channel.ts                  — Channel base class
│   ├── socket.ts                   — Socket class
│   ├── router.ts                   — Channel route registration (public/private/presence)
│   ├── channel-route.ts            — ChannelRoute facade
│   ├── broadcast.ts                — broadcast() global function
│   ├── presence-store.ts           — in-memory and Redis presence tracking
│   ├── adapters/
│   │   ├── memory-adapter.ts       — single-process pub/sub
│   │   └── redis-adapter.ts        — multi-process pub/sub via Redis
│   ├── channels-service-provider.ts
│   └── types.ts
├── package.json
├── tsup.config.ts
└── tsconfig.json
```

---

## Implementation Steps

### Step 1 — WebSocket Transport + Channel Router (Week 1-2)

Set up `@fastify/websocket`, implement the connection/handshake protocol, and build the Channel router. Get `Channel.public()` working with a basic echo channel.

### Step 2 — Auth + Private Channels (Week 2-3)

Integrate the auth middleware with WebSocket connections. `socket.user()` must resolve the authenticated user from the JWT/API token sent in the handshake. Private channels reject unauthorized connections.

### Step 3 — Presence Channels + Broadcast (Week 3-4)

Build `PresenceStore` and `joinPresence()`. Implement the `broadcast()` global with the memory adapter. Test multi-client scenarios with presence events.

### Step 4 — Redis Adapter + Client Libraries (Week 4-6)

Implement the Redis pub/sub adapter for multi-process deployments. Build the browser client (`@faber-js/channels/client`). Add `useChannel` and `usePresence` hooks to `@faber-js/bridge-react` and `@faber-js/bridge-vue`.

---

## Testing Plan

- Channel handler receives Socket and can emit events
- Private channel rejects unauthenticated connections
- Private channel resolves `socket.user()` from JWT
- Presence channel tracks connected members correctly
- `broadcast()` reaches all connected clients on the channel
- Redis adapter: broadcast from one process reaches clients on another
- Client library: `useChannel` receives events emitted from server
- Disconnect handler fires on client close
