import { useEffect, useRef } from 'react';

type EventHandlers = Record<string, (data: unknown) => void>;

interface ChannelClientLike {
  public(name: string): { listen(event: string, handler: (data: unknown) => void): void };
  private(name: string): { listen(event: string, handler: (data: unknown) => void): void };
}

let _client: ChannelClientLike | null = null;

export function setChannelsClient(client: ChannelClientLike): void {
  _client = client;
}

export function useChannel(channelName: string, handlers: EventHandlers = {}): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!_client) return;
    const channel = _client.private(channelName);
    for (const [event, handler] of Object.entries(handlersRef.current)) {
      channel.listen(event, (data: unknown) => handler(data));
    }
  }, [channelName]);
}
