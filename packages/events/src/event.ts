import { Application } from '@faberjs/core';
import type {
  EventDispatcherContract,
  EventPayload,
  ListenerConstructor,
  WildcardHandler,
} from './types';
import type { EventDispatcher } from './event-dispatcher';

export class Event {
  static async dispatch(payload: EventPayload): Promise<void> {
    const app = Application.getInstance();
    if (!app.bound('events')) {
      throw new Error('No event service registered. Add EventServiceProvider to bootstrap/app.ts.');
    }
    return app.make<EventDispatcherContract>('events').dispatch(payload);
  }

  static listen(eventType: string, listenerOrHandler: ListenerConstructor | WildcardHandler): void {
    const app = Application.getInstance();
    if (!app.bound('events')) {
      throw new Error('No event service registered. Add EventServiceProvider to bootstrap/app.ts.');
    }
    const dispatcher = app.make<EventDispatcher>('events');
    if (eventType === '*') {
      dispatcher.listenWildcard(listenerOrHandler as WildcardHandler);
    } else {
      dispatcher.listen(eventType, listenerOrHandler as ListenerConstructor);
    }
  }
}
