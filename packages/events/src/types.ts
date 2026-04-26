export type EventPayload = Record<string, unknown>;

export interface EventDispatcherContract {
  dispatch(event: EventPayload): Promise<void>;
}

export interface ListenerContract {
  handle(event: EventPayload): Promise<void> | void;
  readonly queue?: string;
}

export type ListenerConstructor = new () => ListenerContract;
export type ListenMap = Record<string, ListenerConstructor[]>;
export type WildcardHandler = (event: EventPayload) => Promise<void> | void;
