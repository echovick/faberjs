import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createConnection, destroyConnection } from './connection';
import { Model } from './model';
import { ModelNotFoundException } from './exceptions';
import { Schema } from './schema';
import type { HasMany } from './relations';
import type { ColumnValue } from './types';

class Post extends Model {
  static override table = 'posts';
  static override fillable = ['title', 'user_id'] as const;
}

class User extends Model {
  static override table = 'users';
  static override softDeletes = false;
  static override fillable = ['name', 'email'] as const;

  posts(): HasMany<User, Post> {
    return this.hasMany(Post, 'user_id') as HasMany<User, Post>;
  }
}

class SoftPost extends Model {
  static override table = 'soft_posts';
  static override softDeletes = true;
  static override fillable = ['title'] as const;
}

function str(v: ColumnValue | undefined): string {
  return String(v ?? '');
}

function num(v: ColumnValue | undefined): number {
  return Number(v ?? 0);
}

beforeAll(() => {
  createConnection({ client: 'better-sqlite3', connection: { filename: ':memory:' } });
});

afterAll(async () => {
  await destroyConnection();
});

beforeEach(async () => {
  await Schema.create('users', (t) => {
    t.id();
    t.string('name');
    t.string('email');
  });
  await Schema.create('posts', (t) => {
    t.id();
    t.string('title');
    t.integer('user_id');
  });
  await Schema.create('soft_posts', (t) => {
    t.id();
    t.string('title');
    t.softDeletes();
  });
});

afterEach(async () => {
  await Schema.dropIfExists('posts');
  await Schema.dropIfExists('users');
  await Schema.dropIfExists('soft_posts');
});

describe('Model.create()', () => {
  it('inserts a record and returns an instance with an id', async () => {
    const user = await User.create({ name: 'Aisha', email: 'aisha@test.com' });
    expect(user).toBeInstanceOf(User);
    expect(num(user.getAttribute('id'))).toBeGreaterThan(0);
    expect(str(user.getAttribute('name'))).toBe('Aisha');
  });
});

describe('Model.find()', () => {
  it('returns the model by primary key', async () => {
    const created = await User.create({ name: 'Aisha', email: 'a@test.com' });
    const id = num(created.getAttribute('id'));
    const found = await User.find(id);
    expect(found).not.toBeNull();
    expect(str(found?.getAttribute('name'))).toBe('Aisha');
  });

  it('returns null when record does not exist', async () => {
    expect(await User.find(9999)).toBeNull();
  });
});

describe('Model.findOrFail()', () => {
  it('throws ModelNotFoundException for missing record', async () => {
    await expect(User.findOrFail(9999)).rejects.toThrow(ModelNotFoundException);
  });
});

describe('Model.all()', () => {
  it('returns all records', async () => {
    await User.create({ name: 'A', email: 'a@test.com' });
    await User.create({ name: 'B', email: 'b@test.com' });
    const all = await User.all();
    expect(all).toHaveLength(2);
  });
});

describe('Model.where()', () => {
  it('filters records by column value', async () => {
    await User.create({ name: 'Alice', email: 'alice@test.com' });
    await User.create({ name: 'Bob', email: 'bob@test.com' });
    const results = await User.where('name', 'Alice').get();
    expect(results).toHaveLength(1);
    expect(str(results[0]?.getAttribute('name'))).toBe('Alice');
  });

  it('supports operators', async () => {
    await User.create({ name: 'A', email: 'a@test.com' });
    await User.create({ name: 'B', email: 'b@test.com' });
    const results = await User.where('name', '!=', 'A').get();
    expect(results).toHaveLength(1);
    expect(str(results[0]?.getAttribute('name'))).toBe('B');
  });
});

describe('instance.update()', () => {
  it('updates the record in the database', async () => {
    const user = await User.create({ name: 'Old', email: 'old@test.com' });
    const id = num(user.getAttribute('id'));
    await user.update({ name: 'New' });
    const found = await User.find(id);
    expect(str(found?.getAttribute('name'))).toBe('New');
  });
});

describe('instance.delete()', () => {
  it('removes the record from the database', async () => {
    const user = await User.create({ name: 'Gone', email: 'gone@test.com' });
    const id = num(user.getAttribute('id'));
    await user.delete();
    expect(await User.find(id)).toBeNull();
  });
});

describe('Soft deletes', () => {
  it('sets deleted_at instead of removing the record', async () => {
    const post = await SoftPost.create({ title: 'Soft' });
    await post.delete();
    const results = await SoftPost.all();
    expect(results).toHaveLength(0);
  });

  it('withTrashed() includes soft-deleted records', async () => {
    const post = await SoftPost.create({ title: 'Soft' });
    await post.delete();
    const results = await SoftPost.withTrashed().get();
    expect(results).toHaveLength(1);
  });

  it('restore() clears deleted_at', async () => {
    const post = await SoftPost.create({ title: 'Soft' });
    await post.delete();
    await post.restore();
    const results = await SoftPost.all();
    expect(results).toHaveLength(1);
  });
});

describe('firstOrFail()', () => {
  it('throws ModelNotFoundException when no result', async () => {
    await expect(User.where('name', 'nobody').firstOrFail()).rejects.toThrow(
      ModelNotFoundException,
    );
  });
});

describe('count()', () => {
  it('returns the number of matching records', async () => {
    await User.create({ name: 'A', email: 'a@test.com' });
    await User.create({ name: 'B', email: 'b@test.com' });
    expect(await User.count()).toBe(2);
    expect(await User.where('name', 'A').count()).toBe(1);
  });
});

describe('orderBy()', () => {
  it('returns records in the specified order', async () => {
    await User.create({ name: 'B', email: 'b@test.com' });
    await User.create({ name: 'A', email: 'a@test.com' });
    const asc = await User.orderBy('name', 'asc').get();
    expect(str(asc[0]?.getAttribute('name'))).toBe('A');
    const desc = await User.orderBy('name', 'desc').get();
    expect(str(desc[0]?.getAttribute('name'))).toBe('B');
  });
});

describe('Eager loading with .with()', () => {
  it('loads hasMany relation', async () => {
    const user = await User.create({ name: 'Alice', email: 'a@test.com' });
    const userId = num(user.getAttribute('id'));
    await Post.create({ title: 'Post 1', user_id: userId });
    await Post.create({ title: 'Post 2', user_id: userId });

    const users = await User.with('posts').get();
    const loadedPosts = users[0]?.getRelation<Post[]>('posts');
    expect(loadedPosts).toHaveLength(2);
  });
});

describe('toObject()', () => {
  it('excludes hidden fields', async () => {
    class SecretUser extends Model {
      static override table = 'users';
      static override hidden = ['email'] as const;
    }
    const u = await SecretUser.create({ name: 'X', email: 'x@test.com' });
    const obj = u.toObject();
    expect(obj['name']).toBe('X');
    expect(obj['email']).toBeUndefined();
  });
});
