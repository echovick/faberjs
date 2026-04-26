import { Application } from './application';

export abstract class Facade {
  private static readonly swaps = new Map<string, unknown>();

  protected static getFacadeAccessor(): string {
    throw new Error(`${this.name} must implement getFacadeAccessor()`);
  }

  protected static resolveRoot<T>(): T {
    const accessor = this.getFacadeAccessor();

    if (Facade.swaps.has(accessor)) {
      return Facade.swaps.get(accessor) as T;
    }

    return Application.getInstance().make<T>(accessor);
  }

  static swap(accessor: string, instance: unknown): void {
    Facade.swaps.set(accessor, instance);
  }

  static clearSwaps(): void {
    Facade.swaps.clear();
  }
}
