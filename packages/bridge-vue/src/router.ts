import type { BridgePage } from '@faber-js/bridge';
import { setPage } from './pageStore';

export async function visit(url: string, method = 'GET', body?: BodyInit): Promise<void> {
  const headers: Record<string, string> = {
    'x-faber-bridge': 'true',
    accept: 'application/json',
  };

  const version = typeof __FABER_BRIDGE_VERSION__ !== 'undefined' ? __FABER_BRIDGE_VERSION__ : '';
  if (version) headers['x-faber-bridge-version'] = version;

  const init: RequestInit = { method, headers };
  if (body && method !== 'GET' && method !== 'HEAD') init.body = body;

  const response = await fetch(url, init);

  if (response.status === 409) {
    const location = response.headers.get('x-faber-bridge-location') ?? url;
    window.location.href = location;
    return;
  }

  if (!response.ok) return;

  const page = (await response.json()) as BridgePage;
  setPage(page);

  window.history.pushState({ bridgePage: page }, '', url);
}

export function setupPopState(): void {
  window.addEventListener('popstate', (event: PopStateEvent) => {
    const state = event.state as { bridgePage?: BridgePage } | null;
    if (state?.bridgePage) {
      setPage(state.bridgePage);
    }
  });
}

declare const __FABER_BRIDGE_VERSION__: string;
