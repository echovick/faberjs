export type EventPayload = Record<string, unknown>;

export interface EventDispatcherContract {
  dispatch(event: EventPayload): Promise<void>;
}
