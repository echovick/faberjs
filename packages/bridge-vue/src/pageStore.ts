import { ref, readonly } from 'vue';
import type { BridgePage } from '@faber-js/bridge';
import type { Ref } from 'vue';

const _currentPage = ref<BridgePage | null>(null);

export const currentPage: Readonly<Ref<BridgePage | null>> = readonly(_currentPage);

export function setPage(page: BridgePage): void {
  _currentPage.value = page;
}

export function getPage(): BridgePage | null {
  return _currentPage.value;
}
