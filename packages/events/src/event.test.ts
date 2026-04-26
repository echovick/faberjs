import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Application } from '@faberjs/core';
import { Event } from './event';
import { EventDispatcher } from './event-dispatcher';
import type { EventPayload, ListenerContract } from './types';

vi.mock('@faberjs/queue', () => ({
  dispatch: vi.fn().mockResolvedValue(undefined),
}));

class TestListener implements ListenerContract {
  static calls: EventPayload[] = [];
  async handle(event: EventPayload): Promise<void> {
    TestListener.calls.push(event);
  }
}

beforeEach(() => {
  TestListener.calls = [];
  const app = new Application();
  const dispatcher = new EventDispatcher();
  app.instance('events', dispatcher);
});

afterEach(() => {
  Application.clearInstance();
});

describe('Event (static facade)', () => {
  describe('Event.dispatch()', () => {
    it('dispatches an event to registered listeners', async () => {
      Event.listen('UserCreated', TestListener);
      await Event.dispatch({ type: 'UserCreated', id: 42 });
      expect(TestListener.calls).toHaveLength(1);
      expect(TestListener.calls[0]).toMatchObject({ type: 'UserCreated', id: 42 });
    });

    it('throws when no event service is bound', async () => {
      Application.clearInstance();
      new Application(); // fresh app with no 'events' binding
      await expect(Event.dispatch({ type: 'Test' })).rejects.toThrow('No event service registered');
    });
  });

  describe('Event.listen()', () => {
    it('registers a typed listener', async () => {
      Event.listen('OrderPlaced', TestListener);
      await Event.dispatch({ type: 'OrderPlaced' });
      expect(TestListener.calls).toHaveLength(1);
    });

    it('registers a wildcard handler with "*"', async () => {
      const caught: EventPayload[] = [];
      Event.listen('*', async (e) => {
        caught.push(e);
      });
      await Event.dispatch({ type: 'AnyEvent' });
      expect(caught).toHaveLength(1);
    });

    it('throws when no event service is bound', () => {
      Application.clearInstance();
      new Application(); // no 'events' binding
      expect(() => Event.listen('Test', TestListener)).toThrow('No event service registered');
    });
  });
});
