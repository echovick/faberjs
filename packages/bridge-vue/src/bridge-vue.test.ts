import { describe, it, expect, beforeEach } from 'vitest';
import { setPage, getPage, currentPage } from './pageStore';
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

describe('pageStore (Vue)', () => {
  beforeEach(() => {
    setPage(makePage({ component: '_reset_', props: {} }));
  });

  describe('setPage / getPage', () => {
    it('stores and retrieves the current page', () => {
      const page = makePage();
      setPage(page);
      expect(getPage()).toEqual(page);
    });

    it('currentPage ref reflects the latest page', () => {
      const page = makePage({ component: 'Users/Index' });
      setPage(page);
      expect(currentPage.value).toEqual(page);
    });

    it('updates correctly on multiple setPage calls', () => {
      setPage(makePage({ component: 'First' }));
      setPage(makePage({ component: 'Second' }));
      expect(getPage()?.component).toBe('Second');
      expect(currentPage.value?.component).toBe('Second');
    });
  });
});
