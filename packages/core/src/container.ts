import 'reflect-metadata';

import {
  BindingNotFoundException,
  NotInjectableException,
  UnresolvableDependencyException,
} from './exceptions';
import type { AbstractToken, Binding, Constructor, ContainerContract, Factory } from './types';

export class Container implements ContainerContract {
  private readonly bindings = new Map<AbstractToken, Binding>();
  private readonly instances = new Map<AbstractToken, unknown>();

  bind<T>(abstract: AbstractToken<T>, factory: Factory<T>): void {
    this.bindings.set(abstract, { factory: factory as Factory, singleton: false });
    this.instances.delete(abstract);
  }

  singleton<T>(abstract: AbstractToken<T>, factory: Factory<T>): void {
    this.bindings.set(abstract, { factory: factory as Factory, singleton: true });
    this.instances.delete(abstract);
  }

  instance<T>(abstract: AbstractToken<T>, value: T): void {
    this.instances.set(abstract, value);
  }

  make<T>(abstract: AbstractToken<T>): T {
    if (this.instances.has(abstract)) {
      return this.instances.get(abstract) as T;
    }

    if (this.bindings.has(abstract)) {
      const binding = this.bindings.get(abstract) as Binding;
      const resolved = binding.factory(this) as T;
      if (binding.singleton) {
        this.instances.set(abstract, resolved);
      }
      return resolved;
    }

    if (typeof abstract === 'function') {
      return this.build(abstract as Constructor<T>);
    }

    const label = typeof abstract === 'symbol' ? abstract.toString() : String(abstract);
    throw new BindingNotFoundException(label);
  }

  call<T>(
    callable: ((container: ContainerContract) => T) | [Constructor | object, string],
    params: Record<string, unknown> = {},
  ): T {
    if (!Array.isArray(callable)) {
      return callable(this);
    }

    const [classOrInstance, method] = callable;
    const instance: object =
      typeof classOrInstance === 'function'
        ? (this.make(classOrInstance as Constructor) as object)
        : classOrInstance;

    const proto = Object.getPrototypeOf(instance) as object;
    const paramTypes =
      (Reflect.getMetadata('design:paramtypes', proto, method) as Constructor[] | undefined) ?? [];

    const args = paramTypes.map((paramType) => {
      const key = paramType.name;
      return key in params ? params[key] : this.make(paramType);
    });

    const record = instance as Record<string, (...fnArgs: unknown[]) => T>;
    if (typeof record[method] !== 'function') {
      throw new Error(`Method [${method}] does not exist on the resolved instance`);
    }

    return record[method].apply(instance, args) as T;
  }

  bound(abstract: AbstractToken): boolean {
    return this.instances.has(abstract) || this.bindings.has(abstract);
  }

  forget(abstract: AbstractToken): void {
    this.bindings.delete(abstract);
    this.instances.delete(abstract);
  }

  forgetInstance(abstract: AbstractToken): void {
    this.instances.delete(abstract);
  }

  private build<T>(target: Constructor<T>): T {
    if (!Reflect.hasMetadata('injectable', target)) {
      throw new NotInjectableException(target.name);
    }

    const paramTypes =
      (Reflect.getMetadata('design:paramtypes', target) as Constructor[] | undefined) ?? [];

    const injectTokens =
      (Reflect.getMetadata('inject:tokens', target) as Map<number, AbstractToken> | undefined) ??
      new Map<number, AbstractToken>();

    const args = paramTypes.map((paramType, index) => {
      const token: AbstractToken = injectTokens.get(index) ?? paramType;
      if ((token as unknown) === Object || token === undefined) {
        throw new UnresolvableDependencyException(target.name, index);
      }
      return this.make(token);
    });

    // Cast to a newable type for instantiation — safe because we verified
    // via reflect-metadata that this target is a concrete, injectable class.
    const Newable = target as unknown as new (...ctorArgs: unknown[]) => T;
    return new Newable(...args);
  }
}
