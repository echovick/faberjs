import type {
  FieldDefinition,
  FieldKind,
  OpenApiProperty,
  OpenApiSchema,
  SchemaShape,
} from './types';

function propertyFor(def: FieldDefinition): OpenApiProperty {
  const prop: OpenApiProperty = {};

  if (def.nullable) prop.nullable = true;
  if (def.hidden) prop.writeOnly = true;

  switch (def.kind as FieldKind) {
    case 'id':
      prop.type = 'integer';
      prop.readOnly = true;
      break;
    case 'integer':
    case 'foreignId':
      prop.type = 'integer';
      break;
    case 'bigInteger':
      prop.type = 'integer';
      prop.format = 'int64';
      break;
    case 'float':
    case 'decimal':
      prop.type = 'number';
      break;
    case 'boolean':
      prop.type = 'boolean';
      break;
    case 'date':
      prop.type = 'string';
      prop.format = 'date';
      break;
    case 'timestamp':
      prop.type = 'string';
      prop.format = 'date-time';
      break;
    case 'uuid':
      prop.type = 'string';
      prop.format = 'uuid';
      break;
    case 'email':
      prop.type = 'string';
      prop.format = 'email';
      break;
    case 'enum':
      prop.type = 'string';
      if (def.enumValues) prop.enum = [...def.enumValues];
      break;
    case 'string':
    case 'text':
      prop.type = 'string';
      break;
    case 'json':
      break;
    default:
      break;
  }

  if (def.min !== undefined) prop.minLength = def.min;
  if (def.max !== undefined) prop.maxLength = def.max;

  return prop;
}

export function buildOpenApiSchema(shape: SchemaShape): OpenApiSchema {
  const properties: Record<string, OpenApiProperty> = {};
  const required: string[] = [];

  for (const [key, field] of Object.entries(shape)) {
    properties[key] = propertyFor(field._def);

    const isRequired =
      !field._def.nullable &&
      !field._def.hasDefault &&
      field._def.kind !== 'id' &&
      !field._def.auto;
    if (isRequired) required.push(key);
  }

  return { type: 'object', properties, required };
}
