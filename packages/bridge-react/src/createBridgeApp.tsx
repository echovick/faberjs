import React, { useState, useEffect } from 'react';
import type { ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import type { BridgePage } from '@faber-js/bridge';
import type { CreateBridgeAppOptions } from './types';
import { setPage, subscribe } from './pageStore';
import { setupPopState } from './router';

type AnyComponent = ComponentType<Record<string, unknown>>;

interface AppProps {
  resolve: CreateBridgeAppOptions['resolve'];
  initialPage: BridgePage;
}

function BridgeApp({ resolve, initialPage }: AppProps): React.ReactElement {
  const [page, updatePage] = useState<BridgePage>(initialPage);
  const [Component, setComponent] = useState<AnyComponent | null>(null);

  useEffect(() => {
    return subscribe(updatePage);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const resolved = await resolve(page.component);
      if (cancelled) return;
      const raw =
        resolved && typeof resolved === 'object' && 'default' in resolved
          ? (resolved as { default: AnyComponent }).default
          : (resolved as AnyComponent);
      setComponent(raw);
    })();
    return () => {
      cancelled = true;
    };
  }, [page.component, resolve]);

  if (!Component) return <></>;

  return <Component {...(page.props as Record<string, unknown>)} />;
}

export async function createBridgeApp(options: CreateBridgeAppOptions): Promise<void> {
  const { id = 'app', resolve } = options;

  const el = document.getElementById(id);
  if (!el) throw new Error(`[bridge-react] No element found with id="${id}"`);

  const rawPage = el.dataset.page;
  if (!rawPage) throw new Error(`[bridge-react] No data-page attribute on #${id}`);

  const initialPage = JSON.parse(rawPage) as BridgePage;
  setPage(initialPage);
  setupPopState();

  const root = createRoot(el);
  root.render(<BridgeApp resolve={resolve} initialPage={initialPage} />);
}
