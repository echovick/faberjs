import type { InputData, RuleObject, RuleValue } from './types';

export class Rule {
  static unique(table: string, column = 'id'): UniqueRule {
    return new UniqueRule(table, column);
  }

  static exists(table: string, column = 'id'): ExistsRule {
    return new ExistsRule(table, column);
  }

  static regex(pattern: RegExp): RegexRule {
    return new RegexRule(pattern);
  }

  static in(...values: string[]): InRule {
    return new InRule(values);
  }
}

export class UniqueRule implements RuleObject {
  readonly name = 'unique';
  readonly #table: string;
  readonly #column: string;
  #ignoreId: RuleValue = null;

  constructor(table: string, column: string) {
    this.#table = table;
    this.#column = column;
  }

  ignore(id: RuleValue): this {
    this.#ignoreId = id;
    return this;
  }

  get table(): string {
    return this.#table;
  }

  get column(): string {
    return this.#column;
  }

  get ignoreId(): RuleValue {
    return this.#ignoreId;
  }

  async validate(field: string, _value: RuleValue, _data: InputData): Promise<string | null> {
    // Actual DB check is delegated to the Validator engine which intercepts UniqueRule directly.
    // This fallback is used only when there is no DB provider configured.
    return `The ${field} has already been taken.`;
  }
}

export class ExistsRule implements RuleObject {
  readonly name = 'exists';
  readonly #table: string;
  readonly #column: string;

  constructor(table: string, column: string) {
    this.#table = table;
    this.#column = column;
  }

  get table(): string {
    return this.#table;
  }

  get column(): string {
    return this.#column;
  }

  async validate(field: string, _value: RuleValue, _data: InputData): Promise<string | null> {
    // Actual DB check delegated to the Validator engine which intercepts ExistsRule directly.
    return `The selected ${field} is invalid.`;
  }
}

export class RegexRule implements RuleObject {
  readonly name = 'regex';
  readonly #pattern: RegExp;

  constructor(pattern: RegExp) {
    this.#pattern = pattern;
  }

  async validate(field: string, value: RuleValue, _data: InputData): Promise<string | null> {
    if (value === null || value === undefined) return null;
    if (!this.#pattern.test(String(value))) {
      return `The ${field} format is invalid.`;
    }
    return null;
  }
}

export class InRule implements RuleObject {
  readonly name = 'in';
  readonly #values: string[];

  constructor(values: string[]) {
    this.#values = values;
  }

  async validate(field: string, value: RuleValue, _data: InputData): Promise<string | null> {
    if (value === null || value === undefined) return null;
    if (!this.#values.includes(String(value))) {
      return `The selected ${field} is invalid.`;
    }
    return null;
  }
}
