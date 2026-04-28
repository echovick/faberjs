import type { BridgePage } from '@faber-js/bridge';
import type { ComponentType, ReactNode } from 'react';

export interface BridgePageProps {
  readonly errors: Readonly<Record<string, string>>;
  readonly flash: Readonly<{ success?: string; error?: string }>;
  readonly [key: string]: unknown;
}

export type BridgePageComponent = ComponentType<BridgePageProps>;

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

export interface LinkProps {
  readonly href: string;
  readonly method?: 'get' | 'post' | 'put' | 'patch' | 'delete';
  readonly children?: ReactNode;
  readonly className?: string;
  readonly preserveScroll?: boolean;
  readonly [key: string]: unknown;
}
