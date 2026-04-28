import type { BroadcastAdapterContract } from '../types';

interface RedisClient {
  publish(channel: string, message: string): Promise<unknown>;
  subscribe(channel: string, listener: (message: string, channel: string) => void): Promise<void>;
  on(event: string, listener: (...args: unknown[]) => void): void;
  disconnect(): void;
}

interface RedisMessage {
  readonly channel: string;
  readonly event: string;
  readonly data: unknown;
}

type ChannelHandler = (event: string, data: unknown) => void;

export class RedisAdapter implements BroadcastAdapterContract {
  readonly #pub: RedisClient;
  readonly #sub: RedisClient;
  readonly #pubSubChannel: string;
  readonly #handlers = new Map<string, ChannelHandler>();

  constructor(pub: RedisClient, sub: RedisClient, pubSubChannel: string) {
    this.#pub = pub;
    this.#sub = sub;
    this.#pubSubChannel = pubSubChannel;
  }

  async publish(channel: string, event: string, data: unknown): Promise<void> {
    const msg: RedisMessage = { channel, event, data };
    await this.#pub.publish(this.#pubSubChannel, JSON.stringify(msg));
  }

  async subscribe(channel: string, handler: ChannelHandler): Promise<void> {
    this.#handlers.set(channel, handler);
    if (this.#handlers.size === 1) {
      await this.#sub.subscribe(this.#pubSubChannel, (message: string) => {
        let parsed: RedisMessage;
        try {
          parsed = JSON.parse(message) as RedisMessage;
        } catch {
          return;
        }
        const h = this.#handlers.get(parsed.channel);
        if (h) h(parsed.event, parsed.data);
      });
    }
  }

  unsubscribe(channel: string): void {
    this.#handlers.delete(channel);
  }

  async close(): Promise<void> {
    this.#handlers.clear();
    this.#pub.disconnect();
    this.#sub.disconnect();
  }
}
