import { Application } from '@faber-js/core';
import type { BroadcastAdapterContract } from './types';

export async function broadcast(channel: string, event: string, data: unknown): Promise<void> {
  const app = Application.getInstance();
  const adapter = app.make<BroadcastAdapterContract>('channels.adapter');
  await adapter.publish(channel, event, data);
}
