import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Application } from '@faberjs/core';
import type { AuthUser } from '@faberjs/http';
import { AuthServiceProvider } from './auth-service-provider';
import { Gate } from './gate';
import { JwtGuard } from './jwt-guard';
import type { AuthConfig, UserProviderContract } from './types';

const testUser: AuthUser = { id: 42, email: 'test@example.com' };

class TestAuthServiceProvider extends AuthServiceProvider {
  protected authConfig(): AuthConfig {
    return { secret: 'test-secret-key', expiresIn: '1h' };
  }

  protected userProvider(): UserProviderContract {
    return {
      findByCredentials: vi.fn().mockResolvedValue(testUser),
      findById: vi.fn().mockResolvedValue(testUser),
    };
  }
}

describe('AuthServiceProvider', () => {
  let app: Application;

  beforeEach(() => {
    app = new Application();
  });

  afterEach(() => {
    Application.clearInstance();
  });

  describe('register()', () => {
    it('binds auth.guard as a JwtGuard singleton', () => {
      const provider = new TestAuthServiceProvider(app);
      provider.register();
      const guard = app.make<JwtGuard>('auth.guard');
      expect(guard).toBeInstanceOf(JwtGuard);
    });

    it('binds gate as a Gate singleton', () => {
      const provider = new TestAuthServiceProvider(app);
      provider.register();
      const gate = app.make<Gate>('gate');
      expect(gate).toBeInstanceOf(Gate);
    });

    it('returns the same guard instance on repeated makes (singleton)', () => {
      const provider = new TestAuthServiceProvider(app);
      provider.register();
      const g1 = app.make('auth.guard');
      const g2 = app.make('auth.guard');
      expect(g1).toBe(g2);
    });

    it('guard can sign and verify tokens using configured secret', async () => {
      const provider = new TestAuthServiceProvider(app);
      provider.register();
      const guard = app.make<JwtGuard>('auth.guard');
      const token = await guard.attempt({ email: 'test@example.com', password: 'secret' });
      expect(token).not.toBeNull();
      const user = await guard.user(token as string);
      expect(user).toEqual(testUser);
    });
  });
});
