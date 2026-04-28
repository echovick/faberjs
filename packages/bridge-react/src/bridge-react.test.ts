import { describe, it, expect, beforeEach } from 'vitest';
import { getPage, setPage, subscribe } from './pageStore';
import type { BridgePage } from '@faber-js/bridge';

function makePage(overrides: Partial<BridgePage> = {}): BridgePage {
  return {
    component: 'Dashboard',
    props: { title: 'Hello' },
    url: '/dashboard',
    version: 'v1',
    ...overrides,
  };
}

describe('pageStore', () => {
  beforeEach(() => {
    // Reset store between tests by setting null-ish page
    setPage(makePage({ component: '_reset_', props: {} }));
  });

  describe('setPage / getPage', () => {
    it('stores and retrieves the current page', () => {
      const page = makePage();
      setPage(page);
      expect(getPage()).toEqual(page);
    });

    it('returns updated page after multiple sets', () => {
      setPage(makePage({ component: 'Users/Index' }));
      setPage(makePage({ component: 'Posts/Index' }));
      expect(getPage()?.component).toBe('Posts/Index');
    });
  });

  describe('subscribe()', () => {
    it('notifies listener when page changes', () => {
      const received: BridgePage[] = [];
      subscribe((p) => received.push(p));

      const page = makePage({ component: 'Users/Show' });
      setPage(page);

      expect(received).toHaveLength(1);
      expect(received[0]).toEqual(page);
    });

    it('returns unsubscribe function that stops notifications', () => {
      const received: BridgePage[] = [];
      const unsub = subscribe((p) => received.push(p));

      setPage(makePage({ component: 'A' }));
      unsub();
      setPage(makePage({ component: 'B' }));

      expect(received).toHaveLength(1);
    });

    it('supports multiple concurrent listeners', () => {
      const calls1: number[] = [];
      const calls2: number[] = [];

      subscribe(() => calls1.push(1));
      subscribe(() => calls2.push(2));

      setPage(makePage());

      expect(calls1).toHaveLength(1);
      expect(calls2).toHaveLength(1);
    });
  });
});
