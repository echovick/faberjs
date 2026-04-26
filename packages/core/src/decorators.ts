import 'reflect-metadata';

import type { AbstractToken } from './types';

export function Injectable(): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata('injectable', true, target);
  };
}

export function Inject(token: AbstractToken): ParameterDecorator {
  return (target, _propertyKey, parameterIndex) => {
    const existing =
      (Reflect.getMetadata('inject:tokens', target) as Map<number, AbstractToken> | undefined) ??
      new Map<number, AbstractToken>();

    existing.set(parameterIndex, token);
    Reflect.defineMetadata('inject:tokens', existing, target);
  };
}
