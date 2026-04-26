import { Application } from '@faberjs/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { event } from './event-helper';
import type { EventDispatcherContract } from './types';

describe('event()', () => {
  afterEach(() => {
    Application.clearInstance();
  });

  describe('when event service is not bound', () => {
    beforeEach(() => {
      new Application();
    });

    it('throws a descriptive error', async () => {
      await expect(event({ type: 'UserRegistered' })).rejects.toThrow(
        'No event service registered',
      );
    });
  });

  describe('when event service is bound', () => {
    let mockDispatcher: EventDispatcherContract;

    beforeEach(() => {
      const app = new Application();
      mockDispatcher = { dispatch: vi.fn().mockResolvedValue(undefined) };
      app.instance('events', mockDispatcher);
    });

    it('calls dispatcher.dispatch() with the event payload', async () => {
      const payload = { type: 'UserRegistered', userId: 1 };
      await event(payload);
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(payload);
    });

    it('returns the promise from dispatcher.dispatch()', async () => {
      await expect(event({ type: 'TestEvent' })).resolves.toBeUndefined();
    });
  });
});
