import { describe, expect, it } from 'vitest';
import { InMemoryConversationMemory } from './memory';

describe('InMemoryConversationMemory', () => {
  describe('add()', () => {
    it('should add messages to history', async () => {
      const memory = new InMemoryConversationMemory();
      memory.add({ role: 'user', content: 'Hello' });
      expect((await memory.getHistory()).length).toBe(1);
    });

    it('should store role and content correctly', async () => {
      const memory = new InMemoryConversationMemory();
      memory.add({ role: 'user', content: 'Hi there' });
      const history = await memory.getHistory();
      expect(history[0]?.role).toBe('user');
      expect(history[0]?.content).toBe('Hi there');
    });

    it('should accumulate multiple messages in order', async () => {
      const memory = new InMemoryConversationMemory();
      memory.add({ role: 'user', content: 'Hello' });
      memory.add({ role: 'assistant', content: 'Hi!' });
      memory.add({ role: 'user', content: 'How are you?' });
      const history = await memory.getHistory();
      expect(history.length).toBe(3);
      expect(history[0]?.role).toBe('user');
      expect(history[1]?.role).toBe('assistant');
      expect(history[2]?.role).toBe('user');
    });

    it('should scope messages by sessionId', async () => {
      const memory = new InMemoryConversationMemory();
      memory.add({ role: 'user', content: 'Session A' }, 'session-a');
      memory.add({ role: 'user', content: 'Session B' }, 'session-b');
      const historyA = await memory.getHistory('session-a');
      const historyB = await memory.getHistory('session-b');
      expect(historyA.length).toBe(1);
      expect(historyA[0]?.content).toBe('Session A');
      expect(historyB.length).toBe(1);
      expect(historyB[0]?.content).toBe('Session B');
    });
  });

  describe('getHistory()', () => {
    it('should return empty array when no messages added', async () => {
      const memory = new InMemoryConversationMemory();
      expect(await memory.getHistory()).toEqual([]);
    });

    it('should return a copy so internal state is not mutated', async () => {
      const memory = new InMemoryConversationMemory();
      memory.add({ role: 'user', content: 'Hello' });
      const history = (await memory.getHistory()) as Array<{ role: string; content: string }>;
      history.push({ role: 'assistant', content: 'Injected' });
      expect((await memory.getHistory()).length).toBe(1);
    });
  });

  describe('clear()', () => {
    it('should remove all messages for the session', async () => {
      const memory = new InMemoryConversationMemory();
      memory.add({ role: 'user', content: 'Hello' });
      memory.add({ role: 'assistant', content: 'Hi' });
      await memory.clear();
      expect((await memory.getHistory()).length).toBe(0);
    });

    it('should allow adding messages after clearing', async () => {
      const memory = new InMemoryConversationMemory();
      memory.add({ role: 'user', content: 'Hello' });
      await memory.clear();
      memory.add({ role: 'user', content: 'Fresh start' });
      expect((await memory.getHistory()).length).toBe(1);
      expect((await memory.getHistory())[0]?.content).toBe('Fresh start');
    });

    it('should only clear the specified session', async () => {
      const memory = new InMemoryConversationMemory();
      memory.add({ role: 'user', content: 'A' }, 'a');
      memory.add({ role: 'user', content: 'B' }, 'b');
      await memory.clear('a');
      expect((await memory.getHistory('a')).length).toBe(0);
      expect((await memory.getHistory('b')).length).toBe(1);
    });
  });
});
