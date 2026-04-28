import type { ConversationMemory, MemoryMessage } from './types';

export class InMemoryConversationMemory implements ConversationMemory {
  #sessions = new Map<string, MemoryMessage[]>();

  add(message: MemoryMessage, sessionId = 'default'): void {
    const messages = this.#sessions.get(sessionId) ?? [];
    messages.push({ role: message.role, content: message.content });
    this.#sessions.set(sessionId, messages);
  }

  async getHistory(sessionId = 'default'): Promise<readonly MemoryMessage[]> {
    return [...(this.#sessions.get(sessionId) ?? [])];
  }

  async clear(sessionId = 'default'): Promise<void> {
    this.#sessions.delete(sessionId);
  }
}
