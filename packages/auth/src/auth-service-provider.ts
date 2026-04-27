import { ServiceProvider } from '@faberjs/core';
import { Gate } from './gate';
import { JwtGuard } from './jwt-guard';
import type { AuthConfig, UserProviderContract } from './types';

export abstract class AuthServiceProvider extends ServiceProvider {
  protected abstract authConfig(): AuthConfig;
  protected abstract userProvider(): UserProviderContract;

  register(): void {
    this.app.singleton('auth.guard', () => new JwtGuard(this.authConfig(), this.userProvider()));
    this.app.singleton('gate', () => new Gate());
  }
}
