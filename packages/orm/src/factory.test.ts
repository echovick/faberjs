import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createConnection, destroyConnection } from './connection';
import { Factory } from './factory';
import { Model } from './model';
import { Schema } from './schema';
import type { ColumnValue } from './types';

class User extends Model {
  static override table = 'users';
  static override fillable = ['name', 'email'] as const;

  get name(): string {
    return String(this.getAttribute('name') ?? '');
  }
}

class UserFactory extends Factory<User> {
  readonly model = User;
  definition(): Record<string, ColumnValue> {
    return { name: 'Test User', email: `user-${Date.now()}@test.com` };
  }
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
});

afterEach(async () => {
  await Schema.dropIfExists('users');
});

describe('Factory', () => {
  it('creates a single model instance in the database', async () => {
    const factory = new UserFactory();
    const [user] = await factory.create();
    expect(user).toBeInstanceOf(User);
    expect(user?.name).toBe('Test User');
    const all = await User.all();
    expect(all).toHaveLength(1);
  });

  it('count(n) creates n records', async () => {
    const factory = new UserFactory();
    await factory.count(3).create();
    expect(await User.count()).toBe(3);
  });

  it('state() overrides specific attributes', async () => {
    const factory = new UserFactory();
    const [user] = await factory.state({ name: 'Custom' }).create();
    expect(user?.name).toBe('Custom');
  });

  it('make() returns instances without persisting', async () => {
    const factory = new UserFactory();
    const users = factory.count(2).make();
    expect(users).toHaveLength(2);
    expect(await User.count()).toBe(0);
  });
});
