import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@faberjs/http';
import { JwtGuard } from './jwt-guard';
import type { UserProviderContract } from './types';

const testSecret = 'super-secret-key-for-testing-purposes-only';
const testConfig = { secret: testSecret, expiresIn: '1h' };

const alice: AuthUser = { id: 1, email: 'alice@example.com' };

function makeProvider(user: AuthUser | null = alice): UserProviderContract {
  return {
    findByCredentials: vi.fn().mockResolvedValue(user),
    findById: vi.fn().mockResolvedValue(user),
  };
}

describe('JwtGuard', () => {
  describe('attempt()', () => {
    it('returns a signed JWT token when credentials are valid', async () => {
      const guard = new JwtGuard(testConfig, makeProvider(alice));
      const token = await guard.attempt({ email: 'alice@example.com', password: 'secret' });
      expect(typeof token).toBe('string');
      expect(token).not.toBeNull();
      expect((token as string).split('.')).toHaveLength(3);
    });

    it('returns null when credentials are invalid', async () => {
      const guard = new JwtGuard(testConfig, makeProvider(null));
      const token = await guard.attempt({ email: 'bad@example.com', password: 'wrong' });
      expect(token).toBeNull();
    });
  });

  describe('user()', () => {
    it('resolves the authenticated user from a valid token', async () => {
      const provider = makeProvider(alice);
      const guard = new JwtGuard(testConfig, provider);
      const token = await guard.attempt({ email: 'alice@example.com', password: 'secret' });
      const user = await guard.user(token as string);
      expect(user).toEqual(alice);
    });

    it('returns null for an invalid token', async () => {
      const guard = new JwtGuard(testConfig, makeProvider());
      const user = await guard.user('not.a.valid.token');
      expect(user).toBeNull();
    });

    it('returns null for a token signed with the wrong secret', async () => {
      const guardA = new JwtGuard({ secret: 'secret-a', expiresIn: '1h' }, makeProvider());
      const token = await guardA.attempt({ email: 'alice@example.com', password: 'secret' });

      const guardB = new JwtGuard({ secret: 'secret-b', expiresIn: '1h' }, makeProvider());
      const user = await guardB.user(token as string);
      expect(user).toBeNull();
    });
  });

  describe('check()', () => {
    it('returns true for a valid token', async () => {
      const guard = new JwtGuard(testConfig, makeProvider());
      const token = await guard.attempt({ email: 'alice@example.com', password: 'secret' });
      expect(await guard.check(token as string)).toBe(true);
    });

    it('returns false for an invalid token', async () => {
      const guard = new JwtGuard(testConfig, makeProvider());
      expect(await guard.check('garbage')).toBe(false);
    });
  });

  describe('id()', () => {
    it('returns the user id from a valid token', async () => {
      const guard = new JwtGuard(testConfig, makeProvider());
      const token = await guard.attempt({ email: 'alice@example.com', password: 'secret' });
      const id = await guard.id(token as string);
      expect(String(id)).toBe(String(alice.id));
    });

    it('returns null for an invalid token', async () => {
      const guard = new JwtGuard(testConfig, makeProvider());
      expect(await guard.id('bad')).toBeNull();
    });
  });
});
