import { ApplicationNotInitializedException } from './exceptions';
import { Container } from './container';
import type { ServiceProvider } from './service-provider';
import type { ApplicationContract } from './types';

export class Application extends Container implements ApplicationContract {
  private static currentInstance: Application | null = null;

  private readonly providers: ServiceProvider[] = [];
  private isBooted = false;
  private readonly base: string;

  constructor(basePath: string = process.cwd()) {
    super();
    this.base = basePath;
    Application.currentInstance = this;
    this.instance('app', this);
  }

  static getInstance(): Application {
    if (Application.currentInstance === null) {
      throw new ApplicationNotInitializedException();
    }
    return Application.currentInstance;
  }

  static clearInstance(): void {
    Application.currentInstance = null;
  }

  getBasePath(): string {
    return this.base;
  }

  register(provider: ServiceProvider): this {
    provider.register();
    this.providers.push(provider);
    return this;
  }

  async boot(): Promise<void> {
    if (this.isBooted) return;
    for (const provider of this.providers) {
      await provider.boot();
    }
    this.isBooted = true;
  }

  get booted(): boolean {
    return this.isBooted;
  }
}
