import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Application } from '@faberjs/core';
import { EventServiceProvider } from './event-service-provider';
import type { EventDispatcherContract, EventPayload, ListenerContract, ListenMap } from './types';

vi.mock('@faberjs/queue', () => ({
  dispatch: vi.fn().mockResolvedValue(undefined),
}));

class UserRegisteredListener implements ListenerContract {
  static calls = 0;
  async handle(_event: EventPayload): Promise<void> {
    UserRegisteredListener.calls++;
  }
}

class AppEventServiceProvider extends EventServiceProvider {
  protected override readonly listen: ListenMap = {
    UserRegistered: [UserRegisteredListener],
  };
}

beforeEach(() => {
  UserRegisteredListener.calls = 0;
});

afterEach(() => {
  Application.clearInstance();
});

describe('EventServiceProvider', () => {
  it('registers the EventDispatcher as the "events" singleton', () => {
    const app = new Application();
    app.register(new AppEventServiceProvider(app));
    expect(app.bound('events')).toBe(true);
  });

  it('wires listeners from the listen map at registration time', async () => {
    const app = new Application();
    app.register(new AppEventServiceProvider(app));
    const dispatcher = app.make<EventDispatcherContract>('events');
    await dispatcher.dispatch({ type: 'UserRegistered' });
    expect(UserRegisteredListener.calls).toBe(1);
  });
});
