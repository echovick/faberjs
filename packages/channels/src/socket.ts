import type { WebSocket } from 'ws';
import type { AuthUser } from '@faber-js/http';
import type { BroadcastAdapterContract, OutboundMessage, SocketContract } from './types';
import type { PresenceStore } from './presence-store';

type SocketRegistry = Map<string, Socket>;

export class Socket implements SocketContract {
  readonly id: string;
  readonly #ws: WebSocket;
  readonly #adapter: BroadcastAdapterContract;
  readonly #presenceStore: PresenceStore;
  readonly #registry: SocketRegistry;
  readonly #subscribedChannels = new Set<string>();
  readonly #listeners = new Map<string, Array<(data: unknown) => void>>();
  #user: AuthUser | null = null;

  constructor(
    id: string,
    ws: WebSocket,
    adapter: BroadcastAdapterContract,
    presenceStore: PresenceStore,
    registry: SocketRegistry,
  ) {
    this.id = id;
    this.#ws = ws;
    this.#adapter = adapter;
    this.#presenceStore = presenceStore;
    this.#registry = registry;
  }

  setUser(user: AuthUser): void {
    this.#user = user;
  }

  join(channel: string): void {
    if (this.#subscribedChannels.has(channel)) return;
    this.#subscribedChannels.add(channel);
    this.#adapter.subscribe(channel, (event: string, data: unknown) => {
      this.#sendEvent(channel, event, data);
    });
  }

  joinPresence(channel: string, memberData: Record<string, unknown>): void {
    this.join(channel);
    this.#presenceStore.add(channel, this.id, memberData);

    const members = this.#presenceStore.get(channel).map((m) => m.data);

    const initMsg: OutboundMessage = { type: 'presence.init', members };
    this.#send(initMsg);

    const joinedMsg: OutboundMessage = { type: 'presence.joined', member: memberData };
    this.#broadcastToOthersOnChannel(channel, joinedMsg);
  }

  leave(channel: string): void {
    if (!this.#subscribedChannels.has(channel)) return;
    this.#subscribedChannels.delete(channel);
    this.#adapter.unsubscribe(channel);

    const memberData = this.#presenceStore.getBySocketId(channel, this.id);
    if (memberData !== undefined) {
      this.#presenceStore.remove(channel, this.id);
      const leftMsg: OutboundMessage = { type: 'presence.left', member: memberData };
      this.#broadcastToOthersOnChannel(channel, leftMsg);
    }
  }

  emit(event: string, data: unknown): void {
    for (const channel of this.#subscribedChannels) {
      this.#sendEvent(channel, event, data);
    }
  }

  to(channel: string): { emit(event: string, data: unknown): void } {
    return {
      emit: (event: string, data: unknown): void => {
        void this.#adapter.publish(channel, event, data);
      },
    };
  }

  broadcast(event: string, data: unknown): void {
    for (const channel of this.#subscribedChannels) {
      void this.#adapter.publish(channel, event, data);
    }
  }

  on(event: string, handler: (data: unknown) => void): void {
    if (!this.#listeners.has(event)) this.#listeners.set(event, []);
    const handlers = this.#listeners.get(event);
    if (handlers) handlers.push(handler);
  }

  user<T = AuthUser>(): T {
    return this.#user as unknown as T;
  }

  dispatch(event: string, data: unknown): void {
    const handlers = this.#listeners.get(event);
    if (handlers) {
      for (const h of handlers) h(data);
    }
  }

  disconnect(): void {
    this.#cleanup();
    this.#ws.close();
  }

  handleClose(): void {
    this.#cleanup();
    const handlers = this.#listeners.get('disconnect');
    if (handlers) {
      for (const h of handlers) h(undefined);
    }
  }

  #cleanup(): void {
    for (const channel of this.#subscribedChannels) {
      this.leave(channel);
    }
    this.#registry.delete(this.id);
  }

  #send(msg: OutboundMessage): void {
    if (this.#ws.readyState === 1 /* OPEN */) {
      this.#ws.send(JSON.stringify(msg));
    }
  }

  #sendEvent(channel: string, event: string, data: unknown): void {
    const msg: OutboundMessage = { type: 'event', channel, event, data };
    this.#send(msg);
  }

  #broadcastToOthersOnChannel(channel: string, msg: OutboundMessage): void {
    for (const socket of this.#registry.values()) {
      if (socket.id !== this.id && socket.isOnChannel(channel)) {
        socket.#send(msg);
      }
    }
  }

  isOnChannel(channel: string): boolean {
    return this.#subscribedChannels.has(channel);
  }
}
