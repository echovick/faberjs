import { dispatch } from '@faberjs/queue';
import type {
  EventDispatcherContract,
  EventPayload,
  ListenerConstructor,
  WildcardHandler,
} from './types';

export class EventDispatcher implements EventDispatcherContract {
  readonly #listeners = new Map<string, ListenerConstructor[]>();
  readonly #wildcards: WildcardHandler[] = [];

  listen(eventType: string, listenerCtor: ListenerConstructor): void {
    const existing = this.#listeners.get(eventType) ?? [];
    existing.push(listenerCtor);
    this.#listeners.set(eventType, existing);
  }

  listenWildcard(handler: WildcardHandler): void {
    this.#wildcards.push(handler);
  }

  async dispatch(payload: EventPayload): Promise<void> {
    const eventType = String(payload['type'] ?? '');

    // Fire wildcard handlers first
    for (const handler of this.#wildcards) {
      await Promise.resolve(handler(payload));
    }

    // Fire typed listeners
    const listenerCtors = this.#listeners.get(eventType) ?? [];
    for (const ListenerCtor of listenerCtors) {
      const listener = new ListenerCtor();
      if (listener.queue) {
        // Queued: wrap as a JobContract and dispatch
        const capturedPayload = payload;
        await dispatch({
          handle: async (): Promise<void> => {
            await Promise.resolve(listener.handle(capturedPayload));
          },
        });
      } else {
        // Sync: fire immediately
        await Promise.resolve(listener.handle(payload));
      }
    }
  }
}
