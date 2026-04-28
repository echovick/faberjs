import type { PresenceMember } from './types';

export class PresenceStore {
  readonly #channels = new Map<string, Map<string, Record<string, unknown>>>();

  add(channel: string, socketId: string, data: Record<string, unknown>): void {
    if (!this.#channels.has(channel)) {
      this.#channels.set(channel, new Map());
    }
    const map = this.#channels.get(channel);
    if (map) map.set(socketId, data);
  }

  remove(channel: string, socketId: string): void {
    const members = this.#channels.get(channel);
    if (!members) return;
    members.delete(socketId);
    if (members.size === 0) this.#channels.delete(channel);
  }

  get(channel: string): PresenceMember[] {
    const members = this.#channels.get(channel);
    if (!members) return [];
    return Array.from(members.entries()).map(([socketId, data]) => ({ socketId, data }));
  }

  getBySocketId(channel: string, socketId: string): Record<string, unknown> | undefined {
    return this.#channels.get(channel)?.get(socketId);
  }

  removeSocket(socketId: string): string[] {
    const left: string[] = [];
    for (const [channel, members] of this.#channels.entries()) {
      if (members.has(socketId)) {
        members.delete(socketId);
        left.push(channel);
        if (members.size === 0) this.#channels.delete(channel);
      }
    }
    return left;
  }

  getChannelsForSocket(socketId: string): string[] {
    const result: string[] = [];
    for (const [channel, members] of this.#channels.entries()) {
      if (members.has(socketId)) result.push(channel);
    }
    return result;
  }
}
