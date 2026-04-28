import { onMounted, onUnmounted } from 'vue';

type EventHandler = (data: unknown) => void;

interface ChannelClientLike {
  public(name: string): { listen(event: string, handler: EventHandler): void };
  private(name: string): { listen(event: string, handler: EventHandler): void };
}

let _client: ChannelClientLike | null = null;

export function setChannelsClient(client: ChannelClientLike): void {
  _client = client;
}

export interface UseChannelResult {
  on(event: string, handler: EventHandler): void;
}

export function useChannel(channelName: string): UseChannelResult {
  const pendingHandlers: Array<{ event: string; handler: EventHandler }> = [];
  let channel: { listen(event: string, handler: EventHandler): void } | null = null;

  onMounted(() => {
    if (!_client) return;
    channel = _client.private(channelName);
    for (const { event, handler } of pendingHandlers) {
      channel.listen(event, handler);
    }
  });

  onUnmounted(() => {
    channel = null;
  });

  return {
    on(event: string, handler: EventHandler): void {
      pendingHandlers.push({ event, handler });
      if (channel) channel.listen(event, handler);
    },
  };
}
