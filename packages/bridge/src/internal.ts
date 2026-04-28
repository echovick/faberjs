import type { Response } from '@faber-js/http';

const BRIDGE_RENDER_SYMBOL = Symbol.for('faber.bridge.render.v1');

interface BridgeRenderMeta {
  readonly component: string;
  readonly rawProps: Record<string, unknown>;
}

export function markBridgeResponse(
  body: Record<string, unknown>,
  component: string,
  rawProps: Record<string, unknown>,
): void {
  (body as Record<symbol, unknown>)[BRIDGE_RENDER_SYMBOL] = { component, rawProps };
}

export function extractBridgeMeta(response: Response): BridgeRenderMeta | undefined {
  const body = response.getBody();
  if (typeof body !== 'object' || body === null) return undefined;
  const val = (body as Record<symbol, unknown>)[BRIDGE_RENDER_SYMBOL];
  if (typeof val !== 'object' || val === null) return undefined;
  if (!('component' in val) || !('rawProps' in val)) return undefined;
  return val as BridgeRenderMeta;
}
