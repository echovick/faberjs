import type { AuthUser } from '@faber-js/http';
import type { Constructor } from '@faber-js/core';

export type ChannelType = 'public' | 'private' | 'presence';

export interface ChannelDefinition {
  readonly pattern: string;
  readonly type: ChannelType;
  readonly middleware: string[];
  readonly handler: ChannelHandlerTuple;
}

export type ChannelHandlerTuple = [Constructor, string];

export interface SocketContract {
  readonly id: string;
  join(channel: string): void;
  joinPresence(channel: string, memberData: Record<string, unknown>): void;
  leave(channel: string): void;
  emit(event: string, data: unknown): void;
  to(channel: string): { emit(event: string, data: unknown): void };
  broadcast(event: string, data: unknown): void;
  on(event: string, handler: (data: unknown) => void): void;
  user<T = AuthUser>(): T;
  disconnect(): void;
}

export interface PresenceMember {
  readonly socketId: string;
  readonly data: Record<string, unknown>;
}

export interface PresenceInfo {
  readonly channel: string;
  readonly members: PresenceMember[];
}

export interface BroadcastAdapterContract {
  publish(channel: string, event: string, data: unknown): Promise<void>;
  subscribe(channel: string, handler: (event: string, data: unknown) => void): void;
  unsubscribe(channel: string): void;
  close(): Promise<void>;
}

export interface ChannelsConfig {
  readonly driver: 'memory' | 'redis';
  readonly redis?: {
    readonly host: string;
    readonly port: number;
    readonly channel: string;
    readonly password?: string;
  };
}

/** Shape of the subscribe handshake message sent by the client */
export interface SubscribeMessage {
  readonly type: 'subscribe';
  readonly channel: string;
  readonly token?: string;
}

/** Shape of a broadcasted event message sent over the wire */
export interface ChannelMessage {
  readonly type: 'event';
  readonly channel: string;
  readonly event: string;
  readonly data: unknown;
}

/** Presence events sent to clients */
export interface PresenceInitMessage {
  readonly type: 'presence.init';
  readonly members: Array<Record<string, unknown>>;
}

export interface PresenceJoinedMessage {
  readonly type: 'presence.joined';
  readonly member: Record<string, unknown>;
}

export interface PresenceLeftMessage {
  readonly type: 'presence.left';
  readonly member: Record<string, unknown>;
}

export type OutboundMessage =
  | ChannelMessage
  | PresenceInitMessage
  | PresenceJoinedMessage
  | PresenceLeftMessage;
