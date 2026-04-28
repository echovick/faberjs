import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Knex, knex } from 'knex';
import { Rule } from './rule-builder';
import { setDbConnectionProvider, Validator } from './validator';

// Shared in-memory DB for both unique and exists tests

let conn: Knex;

beforeAll(() => {
  conn = knex({
    client: 'better-sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true,
  });
  // Wire the validator up to the same connection.
  // The DbProvider interface in validator.ts is structurally compatible with a Knex QueryBuilder.
  setDbConnectionProvider((table) => conn(table));
});

afterAll(async () => {
  await conn.destroy();
});

beforeEach(async () => {
  await conn.schema.createTable('uq_users', (t) => {
    t.increments('id');
    t.string('email');
  });
});

afterEach(async () => {
  await conn.schema.dropTableIfExists('uq_users');
});

describe('unique rule (string syntax)', () => {
  it('passes when value does not exist in table', async () => {
    const r = await new Validator(
      { email: 'new@test.com' },
      { email: 'unique:uq_users,email' },
    ).validate();
    expect(r.passes).toBe(true);
  });

  it('fails when value already exists in table', async () => {
    await conn('uq_users').insert({ email: 'taken@test.com' });

    const r = await new Validator(
      { email: 'taken@test.com' },
      { email: 'unique:uq_users,email' },
    ).validate();
    expect(r.passes).toBe(false);
    expect(r.errors['email']?.[0]).toContain('already been taken');
  });

  it('skips check when value is empty', async () => {
    const r = await new Validator({ email: '' }, { email: 'unique:uq_users,email' }).validate();
    expect(r.passes).toBe(true);
  });
});

describe('Rule.unique() object', () => {
  it('passes when value is not in table', async () => {
    const r = await new Validator(
      { email: 'fresh@test.com' },
      { email: [Rule.unique('uq_users', 'email')] },
    ).validate();
    expect(r.passes).toBe(true);
  });

  it('fails when value exists in table', async () => {
    await conn('uq_users').insert({ email: 'exists@test.com' });

    const r = await new Validator(
      { email: 'exists@test.com' },
      { email: [Rule.unique('uq_users', 'email')] },
    ).validate();
    expect(r.passes).toBe(false);
    expect(r.errors['email']?.[0]).toContain('already been taken');
  });

  it('ignores the given id when checking uniqueness (update scenario)', async () => {
    const [id] = (await conn('uq_users').insert({ email: 'me@test.com' })) as number[];

    const r = await new Validator(
      { email: 'me@test.com' },
      { email: [Rule.unique('uq_users', 'email').ignore(id)] },
    ).validate();
    expect(r.passes).toBe(true);
  });

  it('still fails for a different row even when ignore is set', async () => {
    await conn('uq_users').insert({ email: 'other@test.com' });
    const [myId] = (await conn('uq_users').insert({ email: 'me@test.com' })) as number[];

    // Updating row myId but trying to claim other@test.com which belongs to a different row
    const r = await new Validator(
      { email: 'other@test.com' },
      { email: [Rule.unique('uq_users', 'email').ignore(myId)] },
    ).validate();
    expect(r.passes).toBe(false);
  });
});

describe('exists rule (string syntax)', () => {
  it('passes when the value exists in the table', async () => {
    await conn('uq_users').insert({ email: 'exists@test.com' });
    const idRows = (await conn('uq_users')
      .where('email', 'exists@test.com')
      .select('id')) as Array<{
      id: number;
    }>;
    const insertedId = idRows[0]?.id ?? 0;

    const r = await new Validator(
      { workspace_id: insertedId },
      { workspace_id: 'exists:uq_users,id' },
    ).validate();
    expect(r.passes).toBe(true);
  });

  it('fails when the value does not exist in the table', async () => {
    const r = await new Validator(
      { workspace_id: 99999 },
      { workspace_id: 'exists:uq_users,id' },
    ).validate();
    expect(r.passes).toBe(false);
    expect(r.errors['workspace_id']?.[0]).toContain('invalid');
  });

  it('skips check when value is empty', async () => {
    const r = await new Validator(
      { workspace_id: '' },
      { workspace_id: 'exists:uq_users,id' },
    ).validate();
    expect(r.passes).toBe(true);
  });

  it('defaults the column to the field name when omitted', async () => {
    await conn('uq_users').insert({ email: 'col@test.com' });
    const r = await new Validator(
      { email: 'col@test.com' },
      { email: 'exists:uq_users' },
    ).validate();
    expect(r.passes).toBe(true);
  });
});

describe('Rule.exists() object', () => {
  it('passes when value exists', async () => {
    await conn('uq_users').insert({ email: 'obj@test.com' });
    const objRows = (await conn('uq_users').where('email', 'obj@test.com').select('id')) as Array<{
      id: number;
    }>;
    const objId = objRows[0]?.id ?? 0;

    const r = await new Validator(
      { user_id: objId },
      { user_id: [Rule.exists('uq_users', 'id')] },
    ).validate();
    expect(r.passes).toBe(true);
  });

  it('fails when value does not exist', async () => {
    const r = await new Validator(
      { user_id: 88888 },
      { user_id: [Rule.exists('uq_users', 'id')] },
    ).validate();
    expect(r.passes).toBe(false);
    expect(r.errors['user_id']?.[0]).toContain('invalid');
  });
});
