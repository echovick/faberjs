import { useState, useEffect } from 'react';
import type { BridgePage } from '@faber-js/bridge';
import { getPage, subscribe } from './pageStore';

export function usePage<T extends Record<string, unknown> = Record<string, unknown>>(): Omit<
  BridgePage,
  'props'
> & { props: T } {
  const [page, setPage] = useState<BridgePage>(() => {
    const current = getPage();
    if (!current) throw new Error('[bridge-react] usePage() called before createBridgeApp()');
    return current;
  });

  useEffect(() => {
    return subscribe(setPage);
  }, []);

  return page as Omit<BridgePage, 'props'> & { props: T };
}
