import { ServiceProvider } from '@faberjs/core';
import type { ListenMap } from './types';
import { EventDispatcher } from './event-dispatcher';

export abstract class EventServiceProvider extends ServiceProvider {
  protected readonly listen: ListenMap = {};

  register(): void {
    this.app.singleton('events', () => {
      const dispatcher = new EventDispatcher();
      for (const [eventType, listenerCtors] of Object.entries(this.listen)) {
        for (const ListenerCtor of listenerCtors) {
          dispatcher.listen(eventType, ListenerCtor);
        }
      }
      return dispatcher;
    });
  }
}
