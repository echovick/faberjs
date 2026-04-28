import type {
  ErrorBag,
  FieldRules,
  InputData,
  RuleObject,
  RuleValue,
  ValidationResult,
  ValidationRules,
} from './types';
import { ExistsRule, UniqueRule } from './rule-builder';

// Generic DB query builder interface — intentionally not tied to any specific ORM/knex type.
// The consumer wires up the concrete implementation via setDbConnectionProvider().
interface DbQueryBuilder {
  where(column: string, value: unknown): DbQueryBuilder;
  whereNot(column: string, value: unknown): DbQueryBuilder;
  limit(n: number): DbQueryBuilder;
  select(col: string): Promise<unknown[]>;
}

type DbProvider = (table: string) => DbQueryBuilder;

let dbProvider: DbProvider | null = null;

export function setDbConnectionProvider(provider: DbProvider): void {
  dbProvider = provider;
}

export class Validator {
  readonly #data: InputData;
  readonly #rules: ValidationRules;

  constructor(data: InputData, rules: ValidationRules) {
    this.#data = data;
    this.#rules = rules;
  }

  async validate(): Promise<ValidationResult> {
    const errors: ErrorBag = {};

    for (const [field, fieldRules] of Object.entries(this.#rules)) {
      const ruleList = this.#parseRules(fieldRules);
      const rawValue = this.#data[field];
      // Normalize: treat missing key same as null
      const value: RuleValue = rawValue === undefined ? null : (rawValue as RuleValue);
      const fieldErrors: string[] = [];

      for (const rule of ruleList) {
        const error = await this.#applyRule(field, rule, value);
        if (error !== null) {
          fieldErrors.push(error);
          // Stop on first failure per field (Laravel bail behaviour)
          break;
        }
      }

      if (fieldErrors.length > 0) {
        errors[field] = fieldErrors;
      }
    }

    return { passes: Object.keys(errors).length === 0, errors };
  }

  #parseRules(fieldRules: FieldRules): Array<string | RuleObject> {
    if (typeof fieldRules === 'string') {
      return fieldRules.split('|');
    }
    return fieldRules;
  }

  async #applyRule(
    field: string,
    rule: string | RuleObject,
    value: RuleValue,
  ): Promise<string | null> {
    if (typeof rule !== 'string') {
      if (rule instanceof UniqueRule) {
        return this.#applyUniqueRule(field, rule, value);
      }
      if (rule instanceof ExistsRule) {
        return this.#applyExistsRule(field, rule, value);
      }
      return rule.validate(field, value, this.#data);
    }

    const colonIndex = rule.indexOf(':');
    const ruleName = colonIndex === -1 ? rule : rule.slice(0, colonIndex);
    const param = colonIndex === -1 ? '' : rule.slice(colonIndex + 1);

    switch (ruleName) {
      case 'required':
        return this.#required(field, value);
      case 'string':
        return this.#string(field, value);
      case 'integer':
        return this.#integer(field, value);
      case 'numeric':
        return this.#numeric(field, value);
      case 'boolean':
        return this.#boolean(field, value);
      case 'array':
        return this.#array(field, value);
      case 'email':
        return this.#email(field, value);
      case 'url':
        return this.#url(field, value);
      case 'nullable':
        return null;
      case 'min':
        return this.#min(field, value, Number(param));
      case 'max':
        return this.#max(field, value, Number(param));
      case 'in':
        return this.#inRule(field, value, param.split(','));
      case 'not_in':
        return this.#notIn(field, value, param.split(','));
      case 'confirmed':
        return this.#confirmed(field, value);
      case 'unique': {
        const parts = param.split(',');
        const table = parts[0];
        const column = parts[1] ?? field;
        if (!table) return `The ${field} rule 'unique' requires a table name.`;
        return this.#unique(field, value, table, column);
      }
      case 'exists': {
        const parts = param.split(',');
        const table = parts[0];
        const column = parts[1] ?? field;
        if (!table) return `The ${field} rule 'exists' requires a table name.`;
        return this.#exists(field, value, table, column);
      }
      case 'regex':
        return this.#regexString(field, value, param);
      case 'same':
        return this.#same(field, value, param);
      case 'different':
        return this.#different(field, value, param);
      default:
        return null; // unknown rule — skip silently
    }
  }

  // ── Built-in rules ──────────────────────────────────────────────

  #required(field: string, value: RuleValue): string | null {
    if (value === null || value === undefined || value === '') {
      return `The ${field} field is required.`;
    }
    return null;
  }

  #string(field: string, value: RuleValue): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') return `The ${field} must be a string.`;
    return null;
  }

  #integer(field: string, value: RuleValue): string | null {
    if (value === null || value === undefined) return null;
    if (!Number.isInteger(Number(value)) || isNaN(Number(value))) {
      return `The ${field} must be an integer.`;
    }
    return null;
  }

  #numeric(field: string, value: RuleValue): string | null {
    if (value === null || value === undefined) return null;
    if (isNaN(Number(value))) return `The ${field} must be a number.`;
    return null;
  }

  #boolean(field: string, value: RuleValue): string | null {
    if (value === null || value === undefined) return null;
    const allowed: Array<string | number | boolean> = [
      true,
      false,
      'true',
      'false',
      1,
      0,
      '1',
      '0',
    ];
    if (!allowed.includes(value as string | number | boolean)) {
      return `The ${field} must be a boolean.`;
    }
    return null;
  }

  #array(field: string, value: RuleValue): string | null {
    if (value === null || value === undefined) return null;
    if (!Array.isArray(value)) return `The ${field} must be an array.`;
    return null;
  }

  #email(field: string, value: RuleValue): string | null {
    if (value === null || value === undefined || value === '') return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(value))) return `The ${field} must be a valid email address.`;
    return null;
  }

  #url(field: string, value: RuleValue): string | null {
    if (value === null || value === undefined || value === '') return null;
    try {
      new URL(String(value));
      return null;
    } catch {
      return `The ${field} must be a valid URL.`;
    }
  }

  #min(field: string, value: RuleValue, min: number): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') {
      if (value.length < min) return `The ${field} must be at least ${min} characters.`;
    } else if (typeof value === 'number') {
      if (value < min) return `The ${field} must be at least ${min}.`;
    }
    return null;
  }

  #max(field: string, value: RuleValue, max: number): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') {
      if (value.length > max) return `The ${field} must not exceed ${max} characters.`;
    } else if (typeof value === 'number') {
      if (value > max) return `The ${field} must not exceed ${max}.`;
    }
    return null;
  }

  #inRule(field: string, value: RuleValue, allowed: string[]): string | null {
    if (value === null || value === undefined) return null;
    if (!allowed.includes(String(value))) return `The selected ${field} is invalid.`;
    return null;
  }

  #notIn(field: string, value: RuleValue, disallowed: string[]): string | null {
    if (value === null || value === undefined) return null;
    if (disallowed.includes(String(value))) return `The selected ${field} is invalid.`;
    return null;
  }

  #confirmed(field: string, value: RuleValue): string | null {
    const confirmation = this.#data[`${field}_confirmation`];
    if (value !== confirmation) return `The ${field} confirmation does not match.`;
    return null;
  }

  async #unique(
    field: string,
    value: RuleValue,
    table: string,
    column: string,
  ): Promise<string | null> {
    if (value === null || value === undefined || value === '') return null;
    if (!dbProvider) return null; // no DB configured — skip
    const rows = await dbProvider(table).where(column, value).limit(1).select('id');
    if (rows.length > 0) return `The ${field} has already been taken.`;
    return null;
  }

  async #applyUniqueRule(
    field: string,
    rule: UniqueRule,
    value: RuleValue,
  ): Promise<string | null> {
    if (value === null || value === undefined || value === '') return null;
    if (!dbProvider) return null;
    let query = dbProvider(rule.table).where(rule.column, value);
    if (rule.ignoreId !== null && rule.ignoreId !== undefined) {
      query = query.whereNot('id', rule.ignoreId);
    }
    const rows = await query.limit(1).select('id');
    if (rows.length > 0) return `The ${field} has already been taken.`;
    return null;
  }

  async #exists(
    field: string,
    value: RuleValue,
    table: string,
    column: string,
  ): Promise<string | null> {
    if (value === null || value === undefined || value === '') return null;
    if (!dbProvider) return null;
    const rows = await dbProvider(table).where(column, value).limit(1).select('id');
    if (rows.length === 0) return `The selected ${field} is invalid.`;
    return null;
  }

  async #applyExistsRule(
    field: string,
    rule: ExistsRule,
    value: RuleValue,
  ): Promise<string | null> {
    return this.#exists(field, value, rule.table, rule.column);
  }

  #regexString(field: string, value: RuleValue, pattern: string): string | null {
    if (value === null || value === undefined) return null;
    try {
      const regex = new RegExp(pattern);
      if (!regex.test(String(value))) return `The ${field} format is invalid.`;
    } catch {
      return `The ${field} has an invalid regex pattern.`;
    }
    return null;
  }

  #same(field: string, value: RuleValue, otherField: string): string | null {
    const other = this.#data[otherField];
    if (value !== (other as RuleValue)) return `The ${field} and ${otherField} must match.`;
    return null;
  }

  #different(field: string, value: RuleValue, otherField: string): string | null {
    const other = this.#data[otherField];
    if (value === (other as RuleValue)) return `The ${field} and ${otherField} must be different.`;
    return null;
  }
}
