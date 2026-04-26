import type { ApplicationContract } from './types';

export abstract class ServiceProvider {
  constructor(protected readonly app: ApplicationContract) {}

  abstract register(): void;

  boot(): void | Promise<void> {
    return;
  }
}
