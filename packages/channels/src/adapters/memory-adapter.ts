import { EventEmitter } from 'node:events';
import type { BroadcastAdapterContract } from '../types';

export class MemoryAdapter implements BroadcastAdapterContract {
  readonly #emitter = new EventEmitter();

  async publish(channel: string, event: string, data: unknown): Promise<void> {
    this.#emitter.emit(channel, event, data);
  }

  subscribe(channel: string, handler: (event: string, data: unknown) => void): void {
    this.#emitter.on(channel, handler);
  }

  unsubscribe(channel: string): void {
    this.#emitter.removeAllListeners(channel);
  }

  async close(): Promise<void> {
    this.#emitter.removeAllListeners();
  }
}
