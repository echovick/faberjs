import 'reflect-metadata';
import { Application } from '@faber-js/core';
import { getCurrentRequest, ForbiddenException } from '@faber-js/http';
import type { AuthUser } from '@faber-js/http';

interface GateResolvable {
  allows(ability: string, user: AuthUser | null, model?: unknown): Promise<boolean>;
}

export function Authorize(
  ability: string,
  resource?: (args: unknown[]) => unknown,
): MethodDecorator {
  return (_target, _propertyKey, descriptor: PropertyDescriptor) => {
    const original = descriptor.value as (...args: unknown[]) => Promise<unknown>;
    descriptor.value = async function (this: object, ...args: unknown[]) {
      const request = getCurrentRequest();
      const user = request?.user ?? null;
      const resourceValue = resource ? resource(args) : undefined;

      const app = Application.getInstance();
      if (app.bound('gate')) {
        const gate = app.make<GateResolvable>('gate');
        const allowed = await gate.allows(ability, user, resourceValue);
        if (!allowed) throw new ForbiddenException('Not authorized to perform this action');
      }

      return original.apply(this, args);
    };
    return descriptor;
  };
}
