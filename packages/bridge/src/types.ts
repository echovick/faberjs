import type { Request } from '@faber-js/http';

export interface BridgePage {
  readonly component: string;
  readonly props: Record<string, unknown>;
  readonly url: string;
  readonly version: string;
}

export type SharedDataProvider = (
  request: Request,
) => Record<string, unknown> | Promise<Record<string, unknown>>;

export interface BridgeConfig {
  readonly version: string;
  readonly rootView: string;
}
