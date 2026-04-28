import { ApplicationNotInitializedException } from './exceptions';
import { Container } from './container';
import type { ServiceProvider } from './service-provider';
import type { ApplicationContract } from './types';

export type ExceptionReporter = (
  error: Error,
  context: Record<string, unknown>,
) => void | Promise<void>;

export class Application extends Container implements ApplicationContract {
  private static currentInstance: Application | null = null;

  private readonly providers: ServiceProvider[] = [];
  private isBooted = false;
  private readonly base: string;
  private exceptionReporter: ExceptionReporter | null = null;

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

  reportExceptionsUsing(reporter: ExceptionReporter): this {
    this.exceptionReporter = reporter;
    this.instance('exception.reporter', reporter);
    return this;
  }

  async reportException(error: unknown, context: Record<string, unknown> = {}): Promise<void> {
    const err = error instanceof Error ? error : new Error(String(error));
    if (this.exceptionReporter) {
      await Promise.resolve(this.exceptionReporter(err, context));
    } else if (process.env['APP_ENV'] !== 'production') {
      process.stderr.write(`\x1b[31m[Exception]\x1b[0m ${err.stack ?? err.message}\n`);
    }
  }
}
