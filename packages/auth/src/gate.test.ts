import { describe, expect, it } from 'vitest';
import type { AuthUser } from '@faberjs/http';
import { Gate } from './gate';
import { Policy } from './policy';

class Post {
  constructor(public readonly userId: number) {}
}

class PostPolicy extends Policy {
  update(user: AuthUser, post: Post): boolean {
    return user.id === post.userId;
  }

  view(_user: AuthUser, _post: Post): boolean {
    return true;
  }
}

class AdminPolicy extends Policy {
  before(_user: AuthUser, _ability: string): boolean {
    return true;
  }

  update(_user: AuthUser, _post: Post): boolean {
    return false;
  }
}

const alice: AuthUser = { id: 1, name: 'Alice' };
const bob: AuthUser = { id: 2, name: 'Bob' };

describe('Gate', () => {
  describe('registerPolicy()', () => {
    it('registers a policy for a model class', async () => {
      const gate = new Gate();
      gate.registerPolicy(Post, PostPolicy);
      const post = new Post(1);
      expect(await gate.allows('update', alice, post)).toBe(true);
    });
  });

  describe('allows()', () => {
    it('returns true when policy method returns true', async () => {
      const gate = new Gate();
      gate.registerPolicy(Post, PostPolicy);
      const post = new Post(1);
      expect(await gate.allows('update', alice, post)).toBe(true);
    });

    it('returns false when policy method returns false', async () => {
      const gate = new Gate();
      gate.registerPolicy(Post, PostPolicy);
      const post = new Post(1);
      expect(await gate.allows('update', bob, post)).toBe(false);
    });

    it('returns false when user is null', async () => {
      const gate = new Gate();
      gate.registerPolicy(Post, PostPolicy);
      const post = new Post(1);
      expect(await gate.allows('update', null, post)).toBe(false);
    });

    it('returns false when no policy is registered for the model', async () => {
      const gate = new Gate();
      const post = new Post(1);
      expect(await gate.allows('update', alice, post)).toBe(false);
    });

    it('returns false when ability method does not exist on policy', async () => {
      const gate = new Gate();
      gate.registerPolicy(Post, PostPolicy);
      const post = new Post(1);
      expect(await gate.allows('delete', alice, post)).toBe(false);
    });

    it('respects the before() hook — allows all when before() returns true', async () => {
      const gate = new Gate();
      gate.registerPolicy(Post, AdminPolicy);
      const post = new Post(99);
      expect(await gate.allows('update', bob, post)).toBe(true);
    });
  });

  describe('denies()', () => {
    it('returns true when policy denies the action', async () => {
      const gate = new Gate();
      gate.registerPolicy(Post, PostPolicy);
      const post = new Post(1);
      expect(await gate.denies('update', bob, post)).toBe(true);
    });

    it('returns false when policy allows the action', async () => {
      const gate = new Gate();
      gate.registerPolicy(Post, PostPolicy);
      const post = new Post(1);
      expect(await gate.denies('update', alice, post)).toBe(false);
    });
  });
});
