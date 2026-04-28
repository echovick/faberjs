import { ServiceProvider } from '@faber-js/core';
import { Gate } from './gate';
import { JwtGuard } from './jwt-guard';
import { AuthMiddleware } from './auth-middleware';
import type { AuthConfig, UserProviderContract } from './types';

export abstract class AuthServiceProvider extends ServiceProvider {
  protected abstract authConfig(): AuthConfig;
  protected abstract userProvider(): UserProviderContract;

  register(): void {
    const guard = new JwtGuard(this.authConfig(), this.userProvider());
    this.app.singleton('auth.guard', () => guard);
    this.app.singleton('auth.guard.jwt', () => guard);
    this.app.singleton('gate', () => new Gate());
    this.app.singleton('middleware.auth', () => new AuthMiddleware());
  }
}
