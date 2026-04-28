import { useState, useCallback, useRef } from 'react';
import type { BridgePage } from '@faber-js/bridge';
import type { BridgeFormState, BridgeFormOptions } from './types';
import { setPage } from './pageStore';

export function useForm<T extends Record<string, unknown>>(initialValues: T): BridgeFormState<T> {
  const initial = useRef(initialValues);
  const [data, setData] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [processing, setProcessing] = useState(false);

  const setField = useCallback(<K extends keyof T>(key: K, value: T[K]): void => {
    setData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback((): void => {
    setData(initial.current);
    setErrors({});
  }, []);

  const clearErrors = useCallback((): void => {
    setErrors({});
  }, []);

  const submit = useCallback(
    async (method: string, url: string, options: BridgeFormOptions = {}): Promise<void> => {
      setProcessing(true);
      setErrors({});
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
          body: JSON.stringify(data),
        });

        if (response.status === 422) {
          const payload = (await response.json()) as { errors?: Record<string, string> };
          if (payload.errors) {
            setErrors(payload.errors as Partial<Record<keyof T, string>>);
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
        setProcessing(false);
        options.onFinish?.();
      }
    },
    [data],
  );

  const hasErrors = Object.keys(errors).length > 0;

  return {
    data,
    errors,
    processing,
    hasErrors,
    setData: setField,
    reset,
    clearErrors,
    post: (url, opts) => submit('POST', url, opts),
    put: (url, opts) => submit('PUT', url, opts),
    patch: (url, opts) => submit('PATCH', url, opts),
    delete: (url, opts) => submit('DELETE', url, opts),
  };
}

declare const __FABER_BRIDGE_VERSION__: string;
