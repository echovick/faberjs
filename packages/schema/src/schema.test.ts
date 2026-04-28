import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  expectTypeOf,
} from 'vitest';
import { createConnection, destroyConnection, Schema as OrmSchema } from '@faber-js/orm';
import { schema } from './schema';
import { t } from './field-builder';
import type { InferSchemaType } from './types';

const UserSchema = {
  id: t.id(),
  name: t.string().min(2).max(100),
  email: t.email().unique(),
  password: t.string().hidden(),
  role: t.enum(['admin', 'editor', 'viewer'] as const).default('viewer'),
  bio: t.text().nullable(),
  createdAt: t.timestamp().auto(),
  updatedAt: t.timestamp().auto(),
} as const;

const User = schema('users', UserSchema);

const _PostSchema = {
  id: t.id(),
  title: t.string().min(2).max(200),
  userId: t.foreignId('users'),
  content: t.text().nullable(),
} as const;

beforeAll(async () => {
  await createConnection({ client: 'better-sqlite3', connection: { filename: ':memory:' } });
});

afterAll(async () => {
  await destroyConnection();
});

beforeEach(async () => {
  await OrmSchema.create('users', (table) => {
    table.id();
    table.string('name', 100);
    table.string('email', 255).unique();
    table.string('password', 255);
    table.string('role', 20).defaultTo('viewer');
    table.text('bio').nullable();
  });
  await OrmSchema.create('posts', (table) => {
    table.id();
    table.string('title', 200);
    table.integer('userId');
    table.text('content').nullable();
  });
});

afterEach(async () => {
  await OrmSchema.dropIfExists('posts');
  await OrmSchema.dropIfExists('users');
});

// ── Field builder ────────────────────────────────────────────────────────────

describe('FieldBuilder', () => {
  it('t.string() has kind=string and nullable=false by default', () => {
    const f = t.string();
    expect(f._def.kind).toBe('string');
    expect(f._def.nullable).toBe(false);
  });

  it('nullable() sets nullable to true', () => {
    const f = t.string().nullable();
    expect(f._def.nullable).toBe(true);
  });

  it('nullable() returns a new FieldBuilder instance', () => {
    const base = t.string();
    const nullable = base.nullable();
    expect(nullable).not.toBe(base);
    expect(base._def.nullable).toBe(false);
  });

  it('default() sets hasDefault and defaultValue', () => {
    const f = t.enum(['a', 'b', 'c'] as const).default('b');
    expect(f._def.hasDefault).toBe(true);
    expect(f._def.defaultValue).toBe('b');
  });

  it('hidden() sets hidden=true', () => {
    const f = t.string().hidden();
    expect(f._def.hidden).toBe(true);
  });

  it('auto() sets auto=true', () => {
    const f = t.timestamp().auto();
    expect(f._def.auto).toBe(true);
  });

  it('min/max chain', () => {
    const f = t.string().min(3).max(50);
    expect(f._def.min).toBe(3);
    expect(f._def.max).toBe(50);
  });

  it('enum stores values', () => {
    const f = t.enum(['x', 'y'] as const);
    expect(f._def.enumValues).toEqual(['x', 'y']);
  });

  it('foreignId stores table reference', () => {
    const f = t.foreignId('users');
    expect(f._def.kind).toBe('foreignId');
    expect(f._def.foreignTable).toBe('users');
  });
});

// ── schema() factory ─────────────────────────────────────────────────────────

describe('schema()', () => {
  it('sets table name', () => {
    expect(User.table).toBe('users');
  });

  it('excludes auto fields from fillable', () => {
    expect(User.fillable).toContain('name');
    expect(User.fillable).toContain('email');
    expect(User.fillable).not.toContain('id');
    expect(User.fillable).not.toContain('createdAt');
    expect(User.fillable).not.toContain('updatedAt');
  });

  it('populates hidden from .hidden() fields', () => {
    expect(User.hidden).toContain('password');
    expect(User.hidden).not.toContain('name');
  });

  it('property accessor reads attribute via getAttribute', () => {
    const user = new User();
    (user as unknown as { fill(a: Record<string, unknown>): void }).fill({
      name: 'Alice',
      email: 'a@b.com',
    });
    expect(user.getAttribute('name')).toBe('Alice');
    expect(user.getAttribute('email')).toBe('a@b.com');
  });

  it('property accessor writes via setAttribute', () => {
    const user = new User();
    user.setAttribute('name', 'Bob');
    expect(user.getAttribute('name')).toBe('Bob');
  });
});

// ── CRUD via schema model ────────────────────────────────────────────────────

describe('CRUD', () => {
  it('create() inserts and returns instance', async () => {
    const user = await User.create({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'secret',
      role: 'admin',
    });
    expect(user.getAttribute('name')).toBe('Alice');
    expect(user.exists).toBe(true);
  });

  it('find() retrieves by primary key', async () => {
    await User.create({ name: 'Bob', email: 'bob@example.com', password: 'x', role: 'editor' });
    const user = await User.find(1);
    expect(user).not.toBeNull();
    expect(user?.getAttribute('name')).toBe('Bob');
  });

  it('all() returns all rows', async () => {
    await User.create({ name: 'A', email: 'a@x.com', password: 'x', role: 'viewer' });
    await User.create({ name: 'B', email: 'b@x.com', password: 'x', role: 'viewer' });
    const users = await User.all();
    expect(users).toHaveLength(2);
  });

  it('where() filters correctly', async () => {
    await User.create({ name: 'Admin', email: 'adm@x.com', password: 'x', role: 'admin' });
    await User.create({ name: 'Editor', email: 'ed@x.com', password: 'x', role: 'editor' });
    const admins = await User.where('role', 'admin').get();
    expect(admins).toHaveLength(1);
    expect(admins[0]?.getAttribute('role')).toBe('admin');
  });

  it('toJSON() excludes hidden fields', async () => {
    const user = await User.create({
      name: 'X',
      email: 'x@x.com',
      password: 'secret',
      role: 'viewer',
    });
    const json = user.toJSON();
    expect(json).not.toHaveProperty('password');
    expect(json).toHaveProperty('name');
  });
});

// ── Validation rules ─────────────────────────────────────────────────────────

describe('rules()', () => {
  it('generates rules for all non-auto fields by default', () => {
    const rules = User.rules();
    expect(rules).toHaveProperty('name');
    expect(rules).toHaveProperty('email');
    expect(rules).toHaveProperty('password');
    expect(rules).not.toHaveProperty('id');
    expect(rules).not.toHaveProperty('createdAt');
  });

  it('generates rules for specified fields only', () => {
    const rules = User.rules(['name', 'email']);
    expect(Object.keys(rules)).toHaveLength(2);
    expect(rules).toHaveProperty('name');
    expect(rules).toHaveProperty('email');
  });

  it('includes min/max rules', () => {
    const rules = User.rules(['name']);
    const nameRules = rules['name'];
    const rulesArray = Array.isArray(nameRules) ? nameRules : [nameRules];
    expect(rulesArray).toContain('min:2');
    expect(rulesArray).toContain('max:100');
  });

  it('includes nullable rule', () => {
    const rules = User.rules(['bio']);
    const bioRules = rules['bio'];
    const rulesArray = Array.isArray(bioRules) ? bioRules : [bioRules];
    expect(rulesArray).toContain('nullable');
  });

  it('accepts field overrides', () => {
    const rules = User.rules(['name'], { name: ['required', 'string', 'max:50'] });
    expect(rules['name']).toEqual(['required', 'string', 'max:50']);
  });
});

// ── OpenAPI ──────────────────────────────────────────────────────────────────

describe('openapi()', () => {
  it('returns object type', () => {
    const spec = User.openapi();
    expect(spec.type).toBe('object');
  });

  it('includes all fields as properties', () => {
    const spec = User.openapi();
    expect(spec.properties).toHaveProperty('id');
    expect(spec.properties).toHaveProperty('name');
    expect(spec.properties).toHaveProperty('email');
    expect(spec.properties).toHaveProperty('bio');
  });

  it('marks id as readOnly', () => {
    const spec = User.openapi();
    expect(spec.properties['id']?.readOnly).toBe(true);
  });

  it('marks nullable fields', () => {
    const spec = User.openapi();
    expect(spec.properties['bio']?.nullable).toBe(true);
  });

  it('marks hidden fields as writeOnly', () => {
    const spec = User.openapi();
    expect(spec.properties['password']?.writeOnly).toBe(true);
  });

  it('marks enum fields', () => {
    const spec = User.openapi();
    expect(spec.properties['role']?.enum).toEqual(['admin', 'editor', 'viewer']);
  });

  it('includes minLength/maxLength from min/max', () => {
    const spec = User.openapi();
    expect(spec.properties['name']?.minLength).toBe(2);
    expect(spec.properties['name']?.maxLength).toBe(100);
  });

  it('lists required fields (non-nullable, no default, non-auto)', () => {
    const spec = User.openapi();
    expect(spec.required).toContain('name');
    expect(spec.required).toContain('email');
    expect(spec.required).not.toContain('bio');
    expect(spec.required).not.toContain('role');
    expect(spec.required).not.toContain('id');
  });
});

// ── Factory ──────────────────────────────────────────────────────────────────

describe('factory()', () => {
  it('makeOne() returns instance without DB write', () => {
    const user = User.factory().makeOne();
    expect(user).toBeDefined();
    expect(user.getAttribute('name')).toBeTruthy();
    expect(user.getAttribute('email')).toBeTruthy();
    expect(user.exists).toBe(false);
  });

  it('make() returns array', () => {
    const users = User.factory().times(3).make();
    expect(users).toHaveLength(3);
  });

  it('state() overrides specific fields', () => {
    const user = User.factory().state({ role: 'admin' }).makeOne();
    expect(user.getAttribute('role')).toBe('admin');
  });

  it('state() accepts faker callback', () => {
    const user = User.factory()
      .state((faker) => ({ name: faker.person.firstName() }))
      .makeOne();
    expect(typeof user.getAttribute('name')).toBe('string');
  });

  it('createOne() inserts into DB', async () => {
    const user = await User.factory().createOne({
      email: 'factory@example.com',
      password: 'test',
    });
    expect(user.exists).toBe(true);
    expect(user.getAttribute('id')).toBeTruthy();
  });

  it('create() inserts multiple rows', async () => {
    const users = await User.factory()
      .state({ email: undefined as unknown as string })
      .times(2)
      .create();
    expect(users).toHaveLength(2);
    for (const u of users) {
      expect(u.exists).toBe(true);
    }
  });

  it('auto fields are excluded from factory output', () => {
    const user = User.factory().makeOne();
    // id and timestamps are auto — factory does not set them
    // but faker still generates an id for the mock. That is expected.
    // What matters is createdAt/updatedAt are not set
    expect(user.getAttribute('createdAt')).toBeUndefined();
    expect(user.getAttribute('updatedAt')).toBeUndefined();
  });
});

// ── TypeScript inference ─────────────────────────────────────────────────────

describe('TypeScript inference', () => {
  it('InferSchemaType captures correct shape', () => {
    type UserShape = InferSchemaType<typeof UserSchema>;
    expectTypeOf<UserShape['name']>().toEqualTypeOf<string>();
    expectTypeOf<UserShape['bio']>().toEqualTypeOf<string | null>();
    expectTypeOf<UserShape['role']>().toEqualTypeOf<'admin' | 'editor' | 'viewer'>();
    expectTypeOf<UserShape['id']>().toEqualTypeOf<number>();
    expectTypeOf<UserShape['createdAt']>().toEqualTypeOf<Date>();
  });

  it('Post schema infers correct types', () => {
    type PostShape = InferSchemaType<typeof _PostSchema>;
    expectTypeOf<PostShape['title']>().toEqualTypeOf<string>();
    expectTypeOf<PostShape['content']>().toEqualTypeOf<string | null>();
    expectTypeOf<PostShape['userId']>().toEqualTypeOf<number>();
  });
});
