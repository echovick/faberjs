import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createConnection, destroyConnection, getConnection, Schema } from '@faber-js/orm';
import { assertDatabaseCount, assertDatabaseHas, assertDatabaseMissing } from './db-assertions';

beforeAll(async () => {
  await createConnection({ client: 'better-sqlite3', connection: { filename: ':memory:' } });
  await Schema.create('people', (table) => {
    table.id();
    table.string('name');
    table.string('email');
  });
  await getConnection()('people').insert({ name: 'Alice', email: 'alice@example.com' });
});

afterAll(async () => {
  await destroyConnection();
});

describe('assertDatabaseHas()', () => {
  it('passes when a matching row exists', async () => {
    await expect(assertDatabaseHas('people', { name: 'Alice' })).resolves.toBeUndefined();
  });

  it('passes matching on multiple columns', async () => {
    await expect(
      assertDatabaseHas('people', { name: 'Alice', email: 'alice@example.com' }),
    ).resolves.toBeUndefined();
  });

  it('throws when no matching row exists', async () => {
    await expect(assertDatabaseHas('people', { name: 'Bob' })).rejects.toThrow(
      'assertDatabaseHas failed',
    );
  });
});

describe('assertDatabaseMissing()', () => {
  it('passes when no matching row exists', async () => {
    await expect(assertDatabaseMissing('people', { name: 'Charlie' })).resolves.toBeUndefined();
  });

  it('throws when a matching row is found', async () => {
    await expect(assertDatabaseMissing('people', { name: 'Alice' })).rejects.toThrow(
      'assertDatabaseMissing failed',
    );
  });
});

describe('assertDatabaseCount()', () => {
  it('passes when count matches', async () => {
    await expect(assertDatabaseCount('people', 1)).resolves.toBeUndefined();
  });

  it('throws when count does not match', async () => {
    await expect(assertDatabaseCount('people', 99)).rejects.toThrow('assertDatabaseCount failed');
  });
});
