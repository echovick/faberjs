import type { Request } from '@faber-js/http';
import type { SharedDataProvider } from './types';

export class SharedData {
  readonly #providers: SharedDataProvider[] = [];

  share(key: string, value: unknown): void;
  share(provider: SharedDataProvider): void;
  share(keyOrProvider: string | SharedDataProvider, value?: unknown): void {
    if (typeof keyOrProvider === 'function') {
      this.#providers.push(keyOrProvider);
    } else {
      const key = keyOrProvider;
      this.#providers.push(() => ({ [key]: value }));
    }
  }

  async all(request: Request): Promise<Record<string, unknown>> {
    if (this.#providers.length === 0) return {};
    const results = await Promise.all(this.#providers.map((p) => p(request)));
    return Object.assign({} as Record<string, unknown>, ...results);
  }
}
