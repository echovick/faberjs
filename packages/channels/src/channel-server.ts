import { randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import type { ApplicationContract } from '@faber-js/core';
import type { AuthUser } from '@faber-js/http';
import { UnauthorizedException } from '@faber-js/http';
import { Socket } from './socket';
import { type PresenceStore } from './presence-store';
import type { BroadcastAdapterContract, SubscribeMessage } from './types';
import type { ChannelRouter } from './router';

/** Minimal subset of FastifyInstance required for WebSocket route registration */
interface FastifyLike {
  get(
    path: string,
    options: { websocket: true },
    handler: (socket: WebSocket, request: unknown) => void,
  ): void;
}

export class ChannelServer {
  readonly #app: ApplicationContract;
  readonly #router: ChannelRouter;
  readonly #adapter: BroadcastAdapterContract;
  readonly #presenceStore: PresenceStore;
  readonly #registry = new Map<string, Socket>();

  constructor(
    app: ApplicationContract,
    router: ChannelRouter,
    adapter: BroadcastAdapterContract,
    presenceStore: PresenceStore,
  ) {
    this.#app = app;
    this.#router = router;
    this.#adapter = adapter;
    this.#presenceStore = presenceStore;
  }

  attach(fastify: FastifyLike): void {
    fastify.get('/_faber/ws', { websocket: true }, (socket: WebSocket) => {
      const socketId = randomUUID();
      const faberSocket = new Socket(
        socketId,
        socket,
        this.#adapter,
        this.#presenceStore,
        this.#registry,
      );
      this.#registry.set(socketId, faberSocket);

      socket.on('message', (raw: Buffer | string) => {
        let msg: unknown;
        try {
          msg = JSON.parse(raw.toString());
        } catch {
          return;
        }

        if (!isSubscribeMessage(msg)) return;
        void this.#handleSubscribe(faberSocket, msg);
      });

      socket.on('close', () => {
        faberSocket.handleClose();
      });
    });
  }

  async #handleSubscribe(faberSocket: Socket, msg: SubscribeMessage): Promise<void> {
    const resolved = this.#router.resolve(msg.channel);
    if (!resolved) return;

    const { definition, params } = resolved;

    if (definition.type === 'private' || definition.type === 'presence') {
      const user = await this.#resolveUser(msg.token);
      if (!user) {
        faberSocket.disconnect();
        return;
      }
      faberSocket.setUser(user);
    }

    const [ControllerClass, method] = definition.handler;
    const instance = this.#app.make(ControllerClass);

    const paramValues = Object.values(params);
    const firstParam = paramValues[0] ?? msg.channel;

    try {
      const handler = (instance as Record<string, unknown>)[method];
      if (typeof handler === 'function') {
        await (handler as (socket: Socket, param: string) => Promise<void>).call(
          instance,
          faberSocket,
          firstParam,
        );
      }
    } catch (err: unknown) {
      if (err instanceof UnauthorizedException) {
        faberSocket.disconnect();
      }
    }
  }

  async #resolveUser(token: string | undefined): Promise<AuthUser | null> {
    if (!token) return null;
    if (!this.#app.bound('auth')) return null;

    try {
      const auth = this.#app.make<{
        guard(name: string): { user(token: string): Promise<AuthUser | null> };
      }>('auth');
      return await auth.guard('api').user(token);
    } catch {
      return null;
    }
  }
}

function isSubscribeMessage(value: unknown): value is SubscribeMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<string, unknown>)['type'] === 'subscribe' &&
    typeof (value as Record<string, unknown>)['channel'] === 'string'
  );
}
