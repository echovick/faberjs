// A class reference usable as a DI token — matches any concrete or abstract class.
// Using `new (...args: never[]) => T` so that classes with specific constructor
// parameters (e.g. `new (db: Database) => T`) are assignable without a cast:
// contravariance means `never` (bottom type) is assignable to any param type.
// The `name` property is present on every class constructor at runtime.
export interface Constructor<T = unknown> {
  new (...args: never[]): T;
  readonly name: string;
}

export type AbstractToken<T = unknown> = string | symbol | Constructor<T>;

export type Factory<T = unknown> = (container: ContainerContract) => T;

export interface Binding<T = unknown> {
  readonly factory: Factory<T>;
  readonly singleton: boolean;
}

export interface ContainerContract {
  bind<T>(abstract: AbstractToken<T>, factory: Factory<T>): void;
  singleton<T>(abstract: AbstractToken<T>, factory: Factory<T>): void;
  instance<T>(abstract: AbstractToken<T>, value: T): void;
  make<T>(abstract: AbstractToken<T>): T;
  call<T>(
    callable: ((container: ContainerContract) => T) | [Constructor | object, string],
    params?: Record<string, unknown>,
  ): T;
  bound(abstract: AbstractToken): boolean;
  forget(abstract: AbstractToken): void;
}

export interface ApplicationContract extends ContainerContract {
  getBasePath(): string;
}
