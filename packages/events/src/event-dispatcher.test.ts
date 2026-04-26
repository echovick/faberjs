import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventDispatcher } from './event-dispatcher';
import type { EventPayload, ListenerContract } from './types';

// Mock @faberjs/queue dispatch so queued listeners don't need Redis
vi.mock('@faberjs/queue', () => ({
  dispatch: vi.fn().mockResolvedValue(undefined),
}));

import { dispatch as mockDispatch } from '@faberjs/queue';

class SyncListener implements ListenerContract {
  static calls: EventPayload[] = [];
  static reset(): void {
    SyncListener.calls = [];
  }

  async handle(event: EventPayload): Promise<void> {
    SyncListener.calls.push(event);
  }
}

class AnotherSyncListener implements ListenerContract {
  static calls: EventPayload[] = [];
  static reset(): void {
    AnotherSyncListener.calls = [];
  }

  async handle(event: EventPayload): Promise<void> {
    AnotherSyncListener.calls.push(event);
  }
}

class QueuedListener implements ListenerContract {
  readonly queue = 'default';
  static calls: EventPayload[] = [];
  static reset(): void {
    QueuedListener.calls = [];
  }

  async handle(event: EventPayload): Promise<void> {
    QueuedListener.calls.push(event);
  }
}

beforeEach(() => {
  SyncListener.reset();
  AnotherSyncListener.reset();
  QueuedListener.reset();
  vi.clearAllMocks();
});

describe('EventDispatcher', () => {
  describe('dispatch() — sync listeners', () => {
    it('fires a registered listener when its event type matches', async () => {
      const dispatcher = new EventDispatcher();
      dispatcher.listen('UserRegistered', SyncListener);

      await dispatcher.dispatch({ type: 'UserRegistered', userId: 1 });

      expect(SyncListener.calls).toHaveLength(1);
      expect(SyncListener.calls[0]).toMatchObject({ type: 'UserRegistered', userId: 1 });
    });

    it('fires listeners in registration order', async () => {
      const order: string[] = [];

      class First implements ListenerContract {
        async handle(): Promise<void> {
          order.push('first');
        }
      }
      class Second implements ListenerContract {
        async handle(): Promise<void> {
          order.push('second');
        }
      }

      const dispatcher = new EventDispatcher();
      dispatcher.listen('TestEvent', First);
      dispatcher.listen('TestEvent', Second);

      await dispatcher.dispatch({ type: 'TestEvent' });

      expect(order).toEqual(['first', 'second']);
    });

    it('does not fire listeners registered for a different event type', async () => {
      const dispatcher = new EventDispatcher();
      dispatcher.listen('OtherEvent', SyncListener);

      await dispatcher.dispatch({ type: 'UserRegistered' });

      expect(SyncListener.calls).toHaveLength(0);
    });

    it('fires multiple listeners for the same event', async () => {
      const dispatcher = new EventDispatcher();
      dispatcher.listen('UserRegistered', SyncListener);
      dispatcher.listen('UserRegistered', AnotherSyncListener);

      await dispatcher.dispatch({ type: 'UserRegistered' });

      expect(SyncListener.calls).toHaveLength(1);
      expect(AnotherSyncListener.calls).toHaveLength(1);
    });
  });

  describe('dispatch() — queued listeners', () => {
    it('dispatches a queued listener as a job instead of running it directly', async () => {
      const dispatcher = new EventDispatcher();
      dispatcher.listen('UserRegistered', QueuedListener);

      await dispatcher.dispatch({ type: 'UserRegistered' });

      // Should have used the queue dispatch, not called handle() directly
      expect(mockDispatch).toHaveBeenCalledOnce();
      expect(QueuedListener.calls).toHaveLength(0);
    });

    it('the queued job wrapper calls the listener handle when executed', async () => {
      vi.mocked(mockDispatch).mockImplementationOnce(async (job) => {
        await job.handle();
      });

      const dispatcher = new EventDispatcher();
      dispatcher.listen('OrderPlaced', QueuedListener);

      await dispatcher.dispatch({ type: 'OrderPlaced' });

      expect(QueuedListener.calls).toHaveLength(1);
    });
  });

  describe('wildcard listeners', () => {
    it('fires wildcard handler for every event type', async () => {
      const caught: EventPayload[] = [];
      const dispatcher = new EventDispatcher();
      dispatcher.listenWildcard(async (e) => {
        caught.push(e);
      });

      await dispatcher.dispatch({ type: 'UserRegistered' });
      await dispatcher.dispatch({ type: 'OrderPlaced' });

      expect(caught).toHaveLength(2);
    });

    it('fires wildcard handler alongside typed listeners', async () => {
      const wildcardCalls: EventPayload[] = [];
      const dispatcher = new EventDispatcher();
      dispatcher.listen('UserRegistered', SyncListener);
      dispatcher.listenWildcard(async (e) => {
        wildcardCalls.push(e);
      });

      await dispatcher.dispatch({ type: 'UserRegistered' });

      expect(SyncListener.calls).toHaveLength(1);
      expect(wildcardCalls).toHaveLength(1);
    });
  });
});
