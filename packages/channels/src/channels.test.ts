import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebSocket } from 'ws';
import { MemoryAdapter } from './adapters/memory-adapter';
import { PresenceStore } from './presence-store';
import { Channel, ChannelRouter } from './router';
import { Socket } from './socket';
import type { SocketContract } from './types';

// ─── MemoryAdapter ───────────────────────────────────────────────────────────

describe('MemoryAdapter', () => {
  it('delivers published events to subscribers', async () => {
    const adapter = new MemoryAdapter();
    const handler = vi.fn();
    adapter.subscribe('test-channel', handler);
    await adapter.publish('test-channel', 'my-event', { x: 1 });
    expect(handler).toHaveBeenCalledWith('my-event', { x: 1 });
  });

  it('does not deliver events after unsubscribe', async () => {
    const adapter = new MemoryAdapter();
    const handler = vi.fn();
    adapter.subscribe('ch', handler);
    adapter.unsubscribe('ch');
    await adapter.publish('ch', 'ev', {});
    expect(handler).not.toHaveBeenCalled();
  });

  it('delivers to multiple subscribers on the same channel', async () => {
    const adapter = new MemoryAdapter();
    const h1 = vi.fn();
    const h2 = vi.fn();
    adapter.subscribe('ch', h1);
    adapter.subscribe('ch', h2);
    await adapter.publish('ch', 'ping', null);
    expect(h1).toHaveBeenCalled();
    expect(h2).toHaveBeenCalled();
  });
});

// ─── PresenceStore ───────────────────────────────────────────────────────────

describe('PresenceStore', () => {
  let store: PresenceStore;

  beforeEach(() => {
    store = new PresenceStore();
  });

  it('adds and retrieves a member', () => {
    store.add('room.1', 'socket-a', { id: 1, name: 'Alice' });
    const members = store.get('room.1');
    expect(members).toHaveLength(1);
    expect(members.at(0)?.data).toMatchObject({ id: 1, name: 'Alice' });
    expect(members.at(0)?.socketId).toBe('socket-a');
  });

  it('removes a member', () => {
    store.add('room.1', 'socket-a', { id: 1 });
    store.add('room.1', 'socket-b', { id: 2 });
    store.remove('room.1', 'socket-a');
    const members = store.get('room.1');
    expect(members).toHaveLength(1);
    expect(members.at(0)?.socketId).toBe('socket-b');
  });

  it('returns empty array for unknown channel', () => {
    expect(store.get('nonexistent')).toEqual([]);
  });

  it('removeSocket cleans up all channels a socket was on', () => {
    store.add('room.1', 'socket-a', { id: 1 });
    store.add('room.2', 'socket-a', { id: 1 });
    const left = store.removeSocket('socket-a');
    expect(left).toContain('room.1');
    expect(left).toContain('room.2');
    expect(store.get('room.1')).toEqual([]);
    expect(store.get('room.2')).toEqual([]);
  });

  it('getBySocketId returns undefined for missing socket', () => {
    expect(store.getBySocketId('room.1', 'unknown')).toBeUndefined();
  });
});

// ─── ChannelRouter ───────────────────────────────────────────────────────────

describe('ChannelRouter', () => {
  let router: ChannelRouter;

  beforeEach(() => {
    router = new ChannelRouter();
  });

  it('resolves a public channel by exact pattern', () => {
    const handler: [new () => object, string] = [class TestChannel {}, 'handle'];
    router.public('notifications', [], handler);
    const result = router.resolve('notifications');
    expect(result).not.toBeNull();
    expect(result?.definition.type).toBe('public');
    expect(result?.params).toEqual({});
  });

  it('resolves a private channel with wildcard param', () => {
    const handler: [new () => object, string] = [class TestChannel {}, 'presence'];
    router.private_('user.{id}', [], handler);
    const result = router.resolve('user.42');
    expect(result).not.toBeNull();
    expect(result?.definition.type).toBe('private');
    expect(result?.params).toMatchObject({ id: '42' });
  });

  it('resolves a presence channel with wildcard param', () => {
    const handler: [new () => object, string] = [class TestChannel {}, 'join'];
    router.presence('room.{slug}', [], handler);
    const result = router.resolve('room.general');
    expect(result).not.toBeNull();
    expect(result?.definition.type).toBe('presence');
    expect(result?.params).toMatchObject({ slug: 'general' });
  });

  it('returns null for unmatched channel name', () => {
    expect(router.resolve('unknown.channel')).toBeNull();
  });

  it('does not match a pattern with a different segment count', () => {
    const handler: [new () => object, string] = [class TestChannel {}, 'handle'];
    router.public('a.b', [], handler);
    expect(router.resolve('a.b.c')).toBeNull();
  });
});

// ─── Channel facade ──────────────────────────────────────────────────────────

describe('Channel (static facade)', () => {
  beforeEach(() => {
    Channel.reset();
  });

  it('registers a public channel', () => {
    const handler: [new () => object, string] = [class {}, 'handle'];
    Channel.public('pings', handler);
    const result = Channel.getRouter().resolve('pings');
    expect(result?.definition.type).toBe('public');
  });

  it('registers a private channel', () => {
    const handler: [new () => object, string] = [class {}, 'handle'];
    Channel.private('user.{id}', handler);
    const result = Channel.getRouter().resolve('user.5');
    expect(result?.definition.type).toBe('private');
  });

  it('registers a presence channel', () => {
    const handler: [new () => object, string] = [class {}, 'join'];
    Channel.presence('room.{slug}', handler);
    const result = Channel.getRouter().resolve('room.lounge');
    expect(result?.definition.type).toBe('presence');
  });
});

// ─── Socket helpers ───────────────────────────────────────────────────────────

function buildSocket(): {
  socket: Socket;
  adapter: MemoryAdapter;
  ws: { send: ReturnType<typeof vi.fn>; readyState: number; close: ReturnType<typeof vi.fn> };
} {
  const adapter = new MemoryAdapter();
  const store = new PresenceStore();
  const registry = new Map<string, Socket>();
  const ws = { send: vi.fn(), readyState: 1, close: vi.fn() };
  const socket = new Socket('test-id', ws as unknown as WebSocket, adapter, store, registry);
  registry.set('test-id', socket);
  return { socket, adapter, ws };
}

// ─── Socket (unit) ───────────────────────────────────────────────────────────

describe('Socket', () => {
  it('emits an event to the WebSocket after joining', async () => {
    const { socket, adapter, ws } = buildSocket();
    socket.join('test-ch');

    await adapter.publish('test-ch', 'ping', { value: 1 });

    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'event', channel: 'test-ch', event: 'ping', data: { value: 1 } }),
    );
  });

  it('registers and fires a disconnect handler', () => {
    const { socket } = buildSocket();
    const handler = vi.fn();
    socket.on('disconnect', handler);
    socket.handleClose();
    expect(handler).toHaveBeenCalled();
  });

  it('dispatch fires registered event handlers', () => {
    const { socket } = buildSocket();
    const handler = vi.fn();
    socket.on('message', handler);
    socket.dispatch('message', { text: 'hello' });
    expect(handler).toHaveBeenCalledWith({ text: 'hello' });
  });

  it('user() returns the set user', () => {
    const { socket } = buildSocket();
    socket.setUser({ id: 99, email: 'test@example.com' } as never);
    const user = socket.user<{ id: number }>();
    expect(user.id).toBe(99);
  });

  it('joinPresence sends presence.init to the joining socket', () => {
    const { socket, ws } = buildSocket();
    socket.joinPresence('room.1', { id: 1, name: 'Alice' });

    const rawCall = (ws.send as ReturnType<typeof vi.fn>).mock.calls.at(0) as unknown[] | undefined;
    expect(rawCall).toBeDefined();
    const sent = JSON.parse(rawCall?.[0] as string) as {
      type: string;
      members: unknown[];
    };
    expect(sent.type).toBe('presence.init');
    expect(sent.members).toHaveLength(1);
  });

  it('isOnChannel returns false before join', () => {
    const { socket } = buildSocket();
    expect(socket.isOnChannel('test-ch')).toBe(false);
  });

  it('isOnChannel returns true after join', () => {
    const { socket } = buildSocket();
    socket.join('test-ch');
    expect(socket.isOnChannel('test-ch')).toBe(true);
  });

  it('isOnChannel returns false after leave', () => {
    const { socket } = buildSocket();
    socket.join('test-ch');
    socket.leave('test-ch');
    expect(socket.isOnChannel('test-ch')).toBe(false);
  });
});

// ─── Socket integration: broadcast() reaches other sockets ──────────────────

describe('Socket cross-socket broadcasting', () => {
  it('to().emit() delivers to another socket on the same channel', async () => {
    const adapter = new MemoryAdapter();
    const store = new PresenceStore();
    const registry = new Map<string, Socket>();

    const makeSock = (
      id: string,
    ): {
      socket: Socket;
      ws: { send: ReturnType<typeof vi.fn>; readyState: number; close: ReturnType<typeof vi.fn> };
    } => {
      const ws = { send: vi.fn(), readyState: 1, close: vi.fn() };
      const s = new Socket(id, ws as unknown as WebSocket, adapter, store, registry);
      registry.set(id, s);
      return { socket: s, ws };
    };

    const { socket: s1 } = makeSock('s1');
    const { socket: s2, ws: ws2 } = makeSock('s2');

    s1.join('channel-x');
    s2.join('channel-x');

    s1.to('channel-x').emit('hello', { msg: 'world' });

    await new Promise((r) => setTimeout(r, 10));

    expect(ws2.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'event',
        channel: 'channel-x',
        event: 'hello',
        data: { msg: 'world' },
      }),
    );
  });
});

// ─── SocketContract shape validation ─────────────────────────────────────────

describe('SocketContract', () => {
  it('Socket implements SocketContract', () => {
    const adapter = new MemoryAdapter();
    const store = new PresenceStore();
    const registry = new Map<string, Socket>();
    const ws = { send: vi.fn(), readyState: 1, close: vi.fn() };
    const socket = new Socket('id', ws as unknown as WebSocket, adapter, store, registry);
    registry.set('id', socket);

    const s: SocketContract = socket;
    expect(typeof s.join).toBe('function');
    expect(typeof s.leave).toBe('function');
    expect(typeof s.emit).toBe('function');
    expect(typeof s.on).toBe('function');
    expect(typeof s.to).toBe('function');
    expect(typeof s.broadcast).toBe('function');
    expect(typeof s.disconnect).toBe('function');
    expect(typeof s.user).toBe('function');
    expect(typeof s.joinPresence).toBe('function');
    expect(s.id).toBe('id');
  });
});
