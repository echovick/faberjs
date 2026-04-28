import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { createConnection, destroyConnection } from '@faber-js/orm';
import { DatabaseConversationMemory } from './database-memory';

const TABLE = 'test_conversations';

beforeEach(async () => {
  const db = await createConnection({
    client: 'better-sqlite3',
    connection: { filename: ':memory:' },
  });

  await db.schema.createTableIfNotExists(TABLE, (t) => {
    t.increments('id');
    t.string('session_id').notNullable();
    t.string('role').notNullable();
    t.text('content').notNullable();
    t.string('created_at').notNullable();
  });
});

afterEach(async () => {
  await destroyConnection();
});

describe('DatabaseConversationMemory', () => {
  describe('add() + getHistory()', () => {
    it('should persist messages and retrieve them in order', async () => {
      const memory = new DatabaseConversationMemory(TABLE);
      memory.add({ role: 'user', content: 'Hello' });

      const history = await memory.getHistory();
      expect(history.length).toBe(1);
      expect(history[0]?.role).toBe('user');
      expect(history[0]?.content).toBe('Hello');
    });

    it('should scope messages by sessionId', async () => {
      const memory = new DatabaseConversationMemory(TABLE);
      memory.add({ role: 'user', content: 'A' }, 'session-a');
      memory.add({ role: 'user', content: 'B' }, 'session-b');

      const histA = await memory.getHistory('session-a');
      const histB = await memory.getHistory('session-b');
      expect(histA.length).toBe(1);
      expect(histA[0]?.content).toBe('A');
      expect(histB.length).toBe(1);
      expect(histB[0]?.content).toBe('B');
    });

    it('should return empty array when no messages', async () => {
      const memory = new DatabaseConversationMemory(TABLE);
      const history = await memory.getHistory('empty-session');
      expect(history).toEqual([]);
    });

    it('should accumulate multiple messages in order', async () => {
      const memory = new DatabaseConversationMemory(TABLE);
      memory.add({ role: 'user', content: 'First' });
      memory.add({ role: 'assistant', content: 'Second' });
      memory.add({ role: 'user', content: 'Third' });

      const history = await memory.getHistory();
      expect(history.length).toBe(3);
      expect(history[0]?.content).toBe('First');
      expect(history[2]?.content).toBe('Third');
    });
  });

  describe('clear()', () => {
    it('should delete all messages for the session', async () => {
      const memory = new DatabaseConversationMemory(TABLE);
      memory.add({ role: 'user', content: 'Hi' });
      await memory.clear();

      const history = await memory.getHistory();
      expect(history.length).toBe(0);
    });

    it('should only clear the specified session', async () => {
      const memory = new DatabaseConversationMemory(TABLE);
      memory.add({ role: 'user', content: 'A' }, 'a');
      memory.add({ role: 'user', content: 'B' }, 'b');

      await memory.clear('a');
      expect((await memory.getHistory('a')).length).toBe(0);
      expect((await memory.getHistory('b')).length).toBe(1);
    });
  });
});
