import type { ConversationMemory, MemoryMessage } from './types';

export class InMemoryConversationMemory implements ConversationMemory {
  #messages: MemoryMessage[] = [];

  add(message: MemoryMessage): void {
    this.#messages.push({ role: message.role, content: message.content });
  }

  getHistory(): readonly MemoryMessage[] {
    return [...this.#messages];
  }

  clear(): void {
    this.#messages = [];
  }
}
