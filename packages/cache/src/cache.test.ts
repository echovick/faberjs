import { describe, it, expect, beforeEach } from 'vitest';
import { Cache } from './cache';
import { MemoryDriver } from './memory-driver';

beforeEach(() => {
  Cache.configure(new MemoryDriver());
});

describe('Cache facade with MemoryDriver', () => {
  describe('put / get roundtrip', () => {
    it('stores and retrieves a string value', async () => {
      await Cache.put('name', 'Alice', 60);
      expect(await Cache.get('name')).toBe('Alice');
    });

    it('stores and retrieves an object value', async () => {
      await Cache.put('user', { id: 1 }, 60);
      expect(await Cache.get('user')).toEqual({ id: 1 });
    });

    it('returns null for a missing key', async () => {
      expect(await Cache.get('nonexistent')).toBeNull();
    });

    it('returns a fallback value for a missing key', async () => {
      expect(await Cache.get('nonexistent', 'default')).toBe('default');
    });

    it('returns a fallback function result for a missing key', async () => {
      const result = await Cache.get('nonexistent', async () => 'computed');
      expect(result).toBe('computed');
    });
  });

  describe('has', () => {
    it('returns true when key exists', async () => {
      await Cache.put('key', 'value', 60);
      expect(await Cache.has('key')).toBe(true);
    });

    it('returns false when key does not exist', async () => {
      expect(await Cache.has('missing')).toBe(false);
    });
  });

  describe('forget', () => {
    it('removes an existing key', async () => {
      await Cache.put('temp', 'data', 60);
      await Cache.forget('temp');
      expect(await Cache.has('temp')).toBe(false);
    });

    it('returns true when key existed', async () => {
      await Cache.put('temp', 'data', 60);
      expect(await Cache.forget('temp')).toBe(true);
    });

    it('returns false when key did not exist', async () => {
      expect(await Cache.forget('ghost')).toBe(false);
    });
  });

  describe('remember', () => {
    it('calls fn and caches the result', async () => {
      let calls = 0;
      const result = await Cache.remember('computed', 60, async () => {
        calls++;
        return 42;
      });
      expect(result).toBe(42);
      expect(calls).toBe(1);
    });

    it('returns cached value on second call without calling fn again', async () => {
      let calls = 0;
      await Cache.remember('computed', 60, async () => {
        calls++;
        return 'first';
      });
      const result = await Cache.remember('computed', 60, async () => {
        calls++;
        return 'second';
      });
      expect(result).toBe('first');
      expect(calls).toBe(1);
    });
  });

  describe('increment / decrement', () => {
    it('increments a key from zero', async () => {
      expect(await Cache.increment('counter')).toBe(1);
    });

    it('increments by a custom amount', async () => {
      await Cache.increment('counter');
      expect(await Cache.increment('counter', 5)).toBe(6);
    });

    it('decrements a key', async () => {
      await Cache.increment('counter', 10);
      expect(await Cache.decrement('counter', 3)).toBe(7);
    });
  });

  describe('flush', () => {
    it('clears all keys', async () => {
      await Cache.put('a', 1, 60);
      await Cache.put('b', 2, 60);
      await Cache.flush();
      expect(await Cache.has('a')).toBe(false);
      expect(await Cache.has('b')).toBe(false);
    });
  });

  describe('TTL expiry', () => {
    it('value is available immediately after put', async () => {
      await Cache.put('ttl-key', 'still-here', 1);
      expect(await Cache.get('ttl-key')).toBe('still-here');
    });

    it('expired entry is lazily evicted on get', async () => {
      const driver = new MemoryDriver();
      Cache.configure(driver);
      // Put with a TTL, then manually backdate the entry's expiresAt
      await Cache.put('expired-key', 'old-value', 60);
      // Access the internal store and manually set expiresAt in the past
      const raw = driver._raw();
      const entry = raw.get('expired-key');
      if (entry) {
        (entry as { expiresAt: number | null }).expiresAt = Date.now() - 1000;
      }
      expect(await Cache.get('expired-key')).toBeNull();
    });
  });

  describe('Cache.fake()', () => {
    it('fake store tracks put calls via assertPut', async () => {
      const fake = Cache.fake();
      await Cache.put('secret', 'value', 60);
      expect(() => fake.assertPut('secret')).not.toThrow();
    });

    it('fake store assertPut with value', async () => {
      const fake = Cache.fake();
      await Cache.put('token', 'abc123', 60);
      expect(() => fake.assertPut('token', 'abc123')).not.toThrow();
    });

    it('fake store assertPut throws when key was not stored', async () => {
      const fake = Cache.fake();
      expect(() => fake.assertPut('never-stored')).toThrow(/never-stored/);
    });

    it('fake store still returns values via get', async () => {
      Cache.fake();
      await Cache.put('x', 99, 60);
      expect(await Cache.get('x')).toBe(99);
    });
  });
});
