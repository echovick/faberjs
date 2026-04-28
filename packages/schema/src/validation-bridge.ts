import { Rule } from '@faber-js/validation';
import type { RuleObject } from '@faber-js/validation';
import type { FieldDefinition, FieldKind, SchemaShape, ValidationRules } from './types';

type RuleEntry = string | RuleObject;

function rulesForField(def: FieldDefinition, fieldName: string, table: string): RuleEntry[] {
  const rules: RuleEntry[] = [];

  if (def.nullable) rules.push('nullable');

  const typeRule = typeRuleFor(def.kind);
  if (typeRule) rules.push(typeRule);

  if (def.kind === 'email') rules.push('email');
  if (def.kind === 'enum' && def.enumValues?.length) {
    rules.push(Rule.in(...def.enumValues));
  }
  if (def.min !== undefined) rules.push(`min:${def.min}`);
  if (def.max !== undefined) rules.push(`max:${def.max}`);
  if (def.unique) rules.push(Rule.unique(table, fieldName));

  return rules;
}

function typeRuleFor(kind: FieldKind): string | null {
  switch (kind) {
    case 'id':
    case 'integer':
    case 'bigInteger':
    case 'foreignId':
      return 'integer';
    case 'string':
    case 'text':
    case 'uuid':
    case 'email':
      return 'string';
    case 'float':
    case 'decimal':
      return 'numeric';
    case 'boolean':
      return 'boolean';
    case 'date':
    case 'timestamp':
      return 'date';
    case 'json':
      return null;
    case 'enum':
      return null;
    default:
      return null;
  }
}

export function buildValidationRules(
  shape: SchemaShape,
  table: string,
  fields?: string[],
  overrides?: ValidationRules,
): ValidationRules {
  const rules: ValidationRules = {};
  const keys = fields ?? Object.keys(shape);

  for (const key of keys) {
    const field = shape[key];
    if (!field) continue;
    if (field._def.auto) continue;

    const base = rulesForField(field._def, key, table);
    const override = overrides?.[key];
    rules[key] = override ?? base;
  }

  return rules;
}
