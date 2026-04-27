import { describe, expect, it } from 'vitest';
import { InMemoryConversationMemory } from './memory';

describe('InMemoryConversationMemory', () => {
  describe('add()', () => {
    it('should add messages to history', () => {
      const memory = new InMemoryConversationMemory();
      memory.add({ role: 'user', content: 'Hello' });
      expect(memory.getHistory().length).toBe(1);
    });

    it('should store role and content correctly', () => {
      const memory = new InMemoryConversationMemory();
      memory.add({ role: 'user', content: 'Hi there' });
      const history = memory.getHistory();
      expect(history[0]?.role).toBe('user');
      expect(history[0]?.content).toBe('Hi there');
    });

    it('should accumulate multiple messages in order', () => {
      const memory = new InMemoryConversationMemory();
      memory.add({ role: 'user', content: 'Hello' });
      memory.add({ role: 'assistant', content: 'Hi!' });
      memory.add({ role: 'user', content: 'How are you?' });
      const history = memory.getHistory();
      expect(history.length).toBe(3);
      expect(history[0]?.role).toBe('user');
      expect(history[1]?.role).toBe('assistant');
      expect(history[2]?.role).toBe('user');
    });
  });

  describe('getHistory()', () => {
    it('should return empty array when no messages added', () => {
      const memory = new InMemoryConversationMemory();
      expect(memory.getHistory()).toEqual([]);
    });

    it('should return a copy so internal state is not mutated', () => {
      const memory = new InMemoryConversationMemory();
      memory.add({ role: 'user', content: 'Hello' });
      const history = memory.getHistory() as Array<{ role: string; content: string }>;
      history.push({ role: 'assistant', content: 'Injected' });
      expect(memory.getHistory().length).toBe(1);
    });
  });

  describe('clear()', () => {
    it('should remove all messages', () => {
      const memory = new InMemoryConversationMemory();
      memory.add({ role: 'user', content: 'Hello' });
      memory.add({ role: 'assistant', content: 'Hi' });
      memory.clear();
      expect(memory.getHistory().length).toBe(0);
    });

    it('should allow adding messages after clearing', () => {
      const memory = new InMemoryConversationMemory();
      memory.add({ role: 'user', content: 'Hello' });
      memory.clear();
      memory.add({ role: 'user', content: 'Fresh start' });
      expect(memory.getHistory().length).toBe(1);
      expect(memory.getHistory()[0]?.content).toBe('Fresh start');
    });
  });
});
