import { createApp, defineComponent, ref, shallowRef, watchEffect, h } from 'vue';
import type { App } from 'vue';
import type { BridgePage } from '@faber-js/bridge';
import type { BridgePageComponent, CreateBridgeAppOptions } from './types';
import { currentPage, setPage } from './pageStore';
import { setupPopState } from './router';

export async function createBridgeApp(options: CreateBridgeAppOptions): Promise<App> {
  const { id = 'app', resolve } = options;

  const el = document.getElementById(id);
  if (!el) throw new Error(`[bridge-vue] No element found with id="${id}"`);

  const rawPage = el.dataset.page;
  if (!rawPage) throw new Error(`[bridge-vue] No data-page attribute on #${id}`);

  const initialPage = JSON.parse(rawPage) as BridgePage;
  setPage(initialPage);
  setupPopState();

  const RootComponent = defineComponent({
    setup() {
      const component = shallowRef<BridgePageComponent | null>(null);
      const currentName = ref('');

      watchEffect(() => {
        const page = currentPage.value;
        if (!page) return;
        if (page.component === currentName.value) return;
        currentName.value = page.component;

        void (async () => {
          const resolved = await resolve(page.component);
          component.value =
            resolved && typeof resolved === 'object' && 'default' in resolved
              ? (resolved as { default: BridgePageComponent }).default
              : (resolved as BridgePageComponent);
        })();
      });

      return () => {
        const page = currentPage.value;
        if (!component.value || !page) return null;
        return h(component.value, page.props as Record<string, unknown>);
      };
    },
  });

  const app = createApp(RootComponent);
  app.mount(el);
  return app;
}
