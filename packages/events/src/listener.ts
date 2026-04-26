import type { EventPayload, ListenerContract } from './types';

export abstract class Listener implements ListenerContract {
  readonly queue?: string;

  abstract handle(event: EventPayload): Promise<void> | void;
}
