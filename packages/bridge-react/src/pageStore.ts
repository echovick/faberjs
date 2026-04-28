import type { BridgePage } from '@faber-js/bridge';

type PageListener = (page: BridgePage) => void;

const listeners: PageListener[] = [];
let currentPage: BridgePage | null = null;

export function setPage(page: BridgePage): void {
  currentPage = page;
  for (const listener of listeners) {
    listener(page);
  }
}

export function getPage(): BridgePage | null {
  return currentPage;
}

export function subscribe(listener: PageListener): () => void {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}
