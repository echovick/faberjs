import { describe, expect, it } from 'vitest';
import { t } from '@faber-js/schema';
import { schemaShapeToJsonSchema } from './structured-output';

describe('schemaShapeToJsonSchema()', () => {
  it('should convert string field to JSON Schema string property', () => {
    const schema = schemaShapeToJsonSchema({ name: t.string() });
    expect(schema.properties['name']?.type).toBe('string');
  });

  it('should convert integer field', () => {
    const schema = schemaShapeToJsonSchema({ count: t.integer() });
    expect(schema.properties['count']?.type).toBe('integer');
  });

  it('should convert boolean field', () => {
    const schema = schemaShapeToJsonSchema({ active: t.boolean() });
    expect(schema.properties['active']?.type).toBe('boolean');
  });

  it('should convert enum field with enum values', () => {
    const schema = schemaShapeToJsonSchema({
      status: t.enum(['pending', 'active', 'done'] as const),
    });
    expect(schema.properties['status']?.type).toBe('string');
    expect(schema.properties['status']?.enum).toEqual(['pending', 'active', 'done']);
  });

  it('should convert uuid field with format', () => {
    const schema = schemaShapeToJsonSchema({ id: t.uuid() });
    expect(schema.properties['id']?.type).toBe('string');
    expect(schema.properties['id']?.format).toBe('uuid');
  });

  it('should convert email field with format', () => {
    const schema = schemaShapeToJsonSchema({ email: t.email() });
    expect(schema.properties['email']?.format).toBe('email');
  });

  it('should convert decimal field to number type', () => {
    const schema = schemaShapeToJsonSchema({ price: t.decimal(10, 2) });
    expect(schema.properties['price']?.type).toBe('number');
  });

  it('should mark nullable fields', () => {
    const schema = schemaShapeToJsonSchema({ bio: t.text().nullable() });
    expect(schema.properties['bio']?.nullable).toBe(true);
  });

  it('should include non-nullable non-default non-auto fields in required', () => {
    const schema = schemaShapeToJsonSchema({
      name: t.string(),
      bio: t.text().nullable(),
      createdAt: t.timestamp().auto(),
    });
    expect(schema.required).toContain('name');
    expect(schema.required).not.toContain('bio');
    expect(schema.required).not.toContain('createdAt');
  });

  it('should not include fields with defaults in required', () => {
    const schema = schemaShapeToJsonSchema({ active: t.boolean().default(true) });
    expect(schema.required).not.toContain('active');
  });

  it('should produce an object type schema', () => {
    const schema = schemaShapeToJsonSchema({ x: t.string() });
    expect(schema.type).toBe('object');
  });
});
