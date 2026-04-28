import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createConnection, destroyConnection } from './connection';
import { Migration, MigrationRunner } from './migration';
import { Schema } from './schema';

class CreateUsersTable extends Migration {
  async up(): Promise<void> {
    await Schema.create('test_users', (t) => {
      t.id();
      t.string('name');
      t.timestamps();
    });
  }
  async down(): Promise<void> {
    await Schema.dropIfExists('test_users');
  }
}

class CreatePostsTable extends Migration {
  async up(): Promise<void> {
    await Schema.create('test_posts', (t) => {
      t.id();
      t.string('title');
    });
  }
  async down(): Promise<void> {
    await Schema.dropIfExists('test_posts');
  }
}

beforeAll(async () => {
  await createConnection({ client: 'better-sqlite3', connection: { filename: ':memory:' } });
});

afterAll(async () => {
  await destroyConnection();
});

afterEach(async () => {
  await Schema.dropIfExists('faber_migrations');
  await Schema.dropIfExists('test_users');
  await Schema.dropIfExists('test_posts');
});

describe('MigrationRunner', () => {
  describe('run()', () => {
    it('runs pending migrations and returns their names', async () => {
      const runner = new MigrationRunner();
      runner.register('2026_01_01_create_users', new CreateUsersTable());
      const executed = await runner.run();
      expect(executed).toContain('2026_01_01_create_users');
      expect(await Schema.hasTable('test_users')).toBe(true);
    });

    it('does not re-run already-executed migrations', async () => {
      const runner = new MigrationRunner();
      runner.register('2026_01_01_create_users', new CreateUsersTable());
      await runner.run();
      const second = await runner.run();
      expect(second).toHaveLength(0);
    });

    it('runs multiple migrations in registration order', async () => {
      const runner = new MigrationRunner();
      runner.register('2026_01_01_create_users', new CreateUsersTable());
      runner.register('2026_01_02_create_posts', new CreatePostsTable());
      const executed = await runner.run();
      expect(executed).toHaveLength(2);
      expect(await Schema.hasTable('test_users')).toBe(true);
      expect(await Schema.hasTable('test_posts')).toBe(true);
    });
  });

  describe('rollback()', () => {
    it('reverses the last batch of migrations', async () => {
      const runner = new MigrationRunner();
      runner.register('2026_01_01_create_users', new CreateUsersTable());
      await runner.run();
      const rolled = await runner.rollback();
      expect(rolled).toContain('2026_01_01_create_users');
      expect(await Schema.hasTable('test_users')).toBe(false);
    });

    it('returns empty array when no migrations to roll back', async () => {
      const runner = new MigrationRunner();
      const rolled = await runner.rollback();
      expect(rolled).toHaveLength(0);
    });

    it('rolls back only the last batch', async () => {
      const runner = new MigrationRunner();
      runner.register('2026_01_01_create_users', new CreateUsersTable());
      runner.register('2026_01_02_create_posts', new CreatePostsTable());
      await runner.run();
      const rolled = await runner.rollback();
      expect(rolled).toHaveLength(2);
    });
  });

  describe('status()', () => {
    it('returns migration records', async () => {
      const runner = new MigrationRunner();
      runner.register('2026_01_01_create_users', new CreateUsersTable());
      await runner.run();
      const status = await runner.status();
      expect(status[0]?.migration).toBe('2026_01_01_create_users');
      expect(status[0]?.batch).toBe(1);
    });
  });
});
