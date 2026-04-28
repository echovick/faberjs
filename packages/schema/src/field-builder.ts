import type { FieldDefinition, FieldKind } from './types';

export class FieldBuilder<TType, TNullable extends boolean = false> {
  // Phantom type markers — never assigned, exist only for TypeScript inference
  declare readonly _type: TType;
  declare readonly _nullable: TNullable;

  readonly _def: FieldDefinition;

  constructor(def: FieldDefinition) {
    this._def = def;
  }

  nullable(): FieldBuilder<TType, true> {
    return new FieldBuilder<TType, true>({ ...this._def, nullable: true });
  }

  default(value: TType): FieldBuilder<TType, TNullable> {
    return new FieldBuilder<TType, TNullable>({
      ...this._def,
      hasDefault: true,
      defaultValue: value as unknown,
    });
  }

  hidden(): FieldBuilder<TType, TNullable> {
    return new FieldBuilder<TType, TNullable>({ ...this._def, hidden: true });
  }

  auto(): FieldBuilder<TType, TNullable> {
    return new FieldBuilder<TType, TNullable>({ ...this._def, auto: true });
  }

  unique(): FieldBuilder<TType, TNullable> {
    return new FieldBuilder<TType, TNullable>({ ...this._def, unique: true });
  }

  index(): FieldBuilder<TType, TNullable> {
    return new FieldBuilder<TType, TNullable>({ ...this._def, index: true });
  }

  unsigned(): FieldBuilder<TType, TNullable> {
    return new FieldBuilder<TType, TNullable>({ ...this._def, unsigned: true });
  }

  min(n: number): FieldBuilder<TType, TNullable> {
    return new FieldBuilder<TType, TNullable>({ ...this._def, min: n });
  }

  max(n: number): FieldBuilder<TType, TNullable> {
    return new FieldBuilder<TType, TNullable>({ ...this._def, max: n });
  }
}

function make<T>(kind: FieldKind, extra: Partial<FieldDefinition> = {}): FieldBuilder<T> {
  return new FieldBuilder<T>({
    kind,
    nullable: false,
    hasDefault: false,
    hidden: false,
    auto: false,
    unique: false,
    index: false,
    unsigned: false,
    ...extra,
  });
}

export const t = {
  id(): FieldBuilder<number> {
    return make<number>('id', { auto: true });
  },

  string(length?: number): FieldBuilder<string> {
    return make<string>('string', length !== undefined ? { length } : {});
  },

  text(): FieldBuilder<string> {
    return make<string>('text');
  },

  integer(): FieldBuilder<number> {
    return make<number>('integer');
  },

  bigInteger(): FieldBuilder<number> {
    return make<number>('bigInteger');
  },

  float(): FieldBuilder<number> {
    return make<number>('float');
  },

  decimal(precision?: number, scale?: number): FieldBuilder<number> {
    return make<number>('decimal', {
      ...(precision !== undefined ? { precision } : {}),
      ...(scale !== undefined ? { scale } : {}),
    });
  },

  boolean(): FieldBuilder<boolean> {
    return make<boolean>('boolean');
  },

  date(): FieldBuilder<Date> {
    return make<Date>('date');
  },

  timestamp(): FieldBuilder<Date> {
    return make<Date>('timestamp');
  },

  json<T = unknown>(): FieldBuilder<T> {
    return make<T>('json');
  },

  uuid(): FieldBuilder<string> {
    return make<string>('uuid');
  },

  email(): FieldBuilder<string> {
    return make<string>('email');
  },

  enum<T extends string>(values: readonly T[]): FieldBuilder<T> {
    return make<T>('enum', { enumValues: values as unknown as readonly string[] });
  },

  foreignId(table: string): FieldBuilder<number> {
    return make<number>('foreignId', { foreignTable: table });
  },
};
