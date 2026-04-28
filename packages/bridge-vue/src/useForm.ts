import { ref, computed } from 'vue';
import type { BridgePage } from '@faber-js/bridge';
import type { BridgeFormState, BridgeFormOptions } from './types';
import { setPage } from './pageStore';

export function useForm<T extends Record<string, unknown>>(initialValues: T): BridgeFormState<T> {
  const initial = { ...initialValues };
  const data = ref<T>({ ...initialValues });
  const errors = ref<Partial<Record<keyof T, string>>>({});
  const processing = ref(false);
  const hasErrors = computed(() => Object.keys(errors.value).length > 0);

  function setData<K extends keyof T>(key: K, value: T[K]): void {
    (data.value as Record<keyof T, unknown>)[key] = value;
  }

  function reset(): void {
    data.value = { ...initial } as T;
    errors.value = {};
  }

  function clearErrors(): void {
    errors.value = {};
  }

  async function submit(
    method: string,
    url: string,
    options: BridgeFormOptions = {},
  ): Promise<void> {
    processing.value = true;
    errors.value = {};
    try {
      const headers: Record<string, string> = {
        'x-faber-bridge': 'true',
        'content-type': 'application/json',
        accept: 'application/json',
      };

      const version =
        typeof __FABER_BRIDGE_VERSION__ !== 'undefined' ? __FABER_BRIDGE_VERSION__ : '';
      if (version) headers['x-faber-bridge-version'] = version;

      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(data.value),
      });

      if (response.status === 422) {
        const payload = (await response.json()) as { errors?: Record<string, string> };
        if (payload.errors) {
          errors.value = payload.errors as Partial<Record<keyof T, string>>;
          options.onError?.(payload.errors);
        }
        return;
      }

      if (response.status === 409) {
        const location = response.headers.get('x-faber-bridge-location') ?? url;
        window.location.href = location;
        return;
      }

      if (response.ok) {
        const page = (await response.json()) as BridgePage;
        setPage(page);
        window.history.pushState({ bridgePage: page }, '', page.url);
        options.onSuccess?.(page);
      }
    } finally {
      processing.value = false;
      options.onFinish?.();
    }
  }

  return {
    get data() {
      return data.value as T;
    },
    get errors() {
      return errors.value as Partial<Record<keyof T, string>>;
    },
    get processing() {
      return processing.value;
    },
    get hasErrors() {
      return hasErrors.value;
    },
    setData,
    reset,
    clearErrors,
    post: (url, opts) => submit('POST', url, opts),
    put: (url, opts) => submit('PUT', url, opts),
    patch: (url, opts) => submit('PATCH', url, opts),
    delete: (url, opts) => submit('DELETE', url, opts),
  };
}

declare const __FABER_BRIDGE_VERSION__: string;
