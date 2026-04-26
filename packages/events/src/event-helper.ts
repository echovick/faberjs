import { Application } from '@faberjs/core';
import type { EventDispatcherContract, EventPayload } from './types';

export async function event(payload: EventPayload): Promise<void> {
  const app = Application.getInstance();

  if (!app.bound('events')) {
    throw new Error(
      'No event service registered. Add EventServiceProvider to your bootstrap/app.ts.',
    );
  }

  return app.make<EventDispatcherContract>('events').dispatch(payload);
}
