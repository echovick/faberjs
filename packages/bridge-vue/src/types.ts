import type { BridgePage } from '@faber-js/bridge';
import type { Component } from 'vue';

export type BridgePageComponent = Component;

export interface CreateBridgeAppOptions {
  readonly id?: string;
  readonly resolve: (
    name: string,
  ) =>
    | BridgePageComponent
    | Promise<BridgePageComponent>
    | { default: BridgePageComponent }
    | Promise<{ default: BridgePageComponent }>;
}

export interface BridgeFormState<T extends Record<string, unknown>> {
  data: T;
  errors: Partial<Record<keyof T, string>>;
  processing: boolean;
  hasErrors: boolean;
  setData<K extends keyof T>(key: K, value: T[K]): void;
  reset(): void;
  clearErrors(): void;
  post(url: string, options?: BridgeFormOptions): Promise<void>;
  put(url: string, options?: BridgeFormOptions): Promise<void>;
  patch(url: string, options?: BridgeFormOptions): Promise<void>;
  delete(url: string, options?: BridgeFormOptions): Promise<void>;
}

export interface BridgeFormOptions {
  readonly onSuccess?: (page: BridgePage) => void;
  readonly onError?: (errors: Record<string, string>) => void;
  readonly onFinish?: () => void;
}
