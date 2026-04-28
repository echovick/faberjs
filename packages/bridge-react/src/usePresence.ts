import { useState, useEffect } from 'react';
import { setChannelsClient } from './useChannel';

export { setChannelsClient };

type MemberData = Record<string, unknown>;

interface PresenceChannelLike {
  here(handler: (members: MemberData[]) => void): void;
  joining(handler: (member: MemberData) => void): void;
  leaving(handler: (member: MemberData) => void): void;
  listen(event: string, handler: (data: unknown) => void): void;
}

interface PresenceClientLike {
  presence(name: string): PresenceChannelLike;
}

let _presenceClient: PresenceClientLike | null = null;

export function setPresenceClient(client: PresenceClientLike): void {
  _presenceClient = client;
}

export interface UsePresenceResult {
  readonly members: MemberData[];
  readonly emit: (event: string, data: unknown) => void;
}

export function usePresence(channelName: string): UsePresenceResult {
  const [members, setMembers] = useState<MemberData[]>([]);

  useEffect(() => {
    if (!_presenceClient) return;
    const channel = _presenceClient.presence(channelName);
    channel.here((all) => setMembers([...all]));
    channel.joining((member) => setMembers((prev) => [...prev, member]));
    channel.leaving((member) => setMembers((prev) => prev.filter((m) => m['id'] !== member['id'])));
  }, [channelName]);

  const emit = (_event: string, _data: unknown): void => {
    // Emitting back via presence is a no-op in the hook; users dispatch via HTTP
  };

  return { members, emit };
}
