import { computed } from 'vue';
import type { ComputedRef } from 'vue';
import type { BridgePage } from '@faber-js/bridge';
import { currentPage } from './pageStore';

export function usePage<T extends Record<string, unknown> = Record<string, unknown>>(): ComputedRef<
  BridgePage & { props: T }
> {
  return computed(() => {
    const page = currentPage.value;
    if (!page) throw new Error('[bridge-vue] usePage() called before createBridgeApp()');
    return page as BridgePage & { props: T };
  });
}
