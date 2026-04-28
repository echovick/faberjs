import { ref, onMounted, onUnmounted } from 'vue';
import type { Ref } from 'vue';

type MemberData = Record<string, unknown>;

interface PresenceChannelLike {
  here(handler: (members: MemberData[]) => void): void;
  joining(handler: (member: MemberData) => void): void;
  leaving(handler: (member: MemberData) => void): void;
}

interface PresenceClientLike {
  presence(name: string): PresenceChannelLike;
}

let _presenceClient: PresenceClientLike | null = null;

export function setPresenceClient(client: PresenceClientLike): void {
  _presenceClient = client;
}

export interface UsePresenceResult {
  readonly members: Ref<MemberData[]>;
  readonly emit: (event: string, data: unknown) => void;
}

export function usePresence(channelName: string): UsePresenceResult {
  const members = ref<MemberData[]>([]);

  onMounted(() => {
    if (!_presenceClient) return;
    const channel = _presenceClient.presence(channelName);
    channel.here((all) => {
      members.value = [...all];
    });
    channel.joining((member) => {
      members.value = [...members.value, member];
    });
    channel.leaving((member) => {
      members.value = members.value.filter((m) => m['id'] !== member['id']);
    });
  });

  onUnmounted(() => {
    members.value = [];
  });

  const emit = (_event: string, _data: unknown): void => {
    // Emitting back via presence is a no-op in the hook; users dispatch via HTTP
  };

  return { members, emit };
}
