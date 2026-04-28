import type { SchemaShape } from '@faber-js/schema';
import type { ToolInputProperty, ToolInputSchema } from './types';

function fieldDefToProperty(def: {
  kind: string;
  nullable: boolean;
  enumValues?: readonly string[];
  min?: number;
  max?: number;
  length?: number;
}): ToolInputProperty {
  const nullable = def.nullable ? { nullable: true as const } : {};

  switch (def.kind) {
    case 'string':
    case 'text':
      return {
        type: 'string',
        ...(def.length !== undefined ? { maxLength: def.length } : {}),
        ...nullable,
      };
    case 'uuid':
      return { type: 'string', format: 'uuid', ...nullable };
    case 'email':
      return { type: 'string', format: 'email', ...nullable };
    case 'integer':
    case 'bigInteger':
    case 'foreignId':
      return {
        type: 'integer',
        ...(def.min !== undefined ? { minimum: def.min } : {}),
        ...(def.max !== undefined ? { maximum: def.max } : {}),
        ...nullable,
      };
    case 'float':
    case 'decimal':
      return {
        type: 'number',
        ...(def.min !== undefined ? { minimum: def.min } : {}),
        ...(def.max !== undefined ? { maximum: def.max } : {}),
        ...nullable,
      };
    case 'boolean':
      return { type: 'boolean', ...nullable };
    case 'date':
    case 'timestamp':
      return { type: 'string', format: 'date-time', ...nullable };
    case 'json':
      return { type: 'object', ...nullable };
    case 'enum':
      return {
        type: 'string',
        enum: (def.enumValues ?? []) as string[],
        ...nullable,
      };
    case 'id':
      return { type: 'integer', ...nullable };
    default:
      return { type: 'string', ...nullable };
  }
}

export function schemaShapeToJsonSchema(shape: SchemaShape): ToolInputSchema {
  const properties: Record<string, ToolInputProperty> = {};
  const required: string[] = [];

  for (const [key, field] of Object.entries(shape)) {
    const def = field._def;
    properties[key] = fieldDefToProperty(def);
    if (!def.nullable && !def.hasDefault && !def.auto) {
      required.push(key);
    }
  }

  return { type: 'object', properties, required };
}
