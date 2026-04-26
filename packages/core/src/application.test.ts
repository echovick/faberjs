import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Application } from './application';
import { ApplicationNotInitializedException } from './exceptions';
import { ServiceProvider } from './service-provider';

class StubProvider extends ServiceProvider {
  override register(): void {
    this.app.instance('stub', { value: 42 });
  }
}

class BootableProvider extends ServiceProvider {
  bootCalled = false;

  override register(): void {}

  override boot(): void {
    this.bootCalled = true;
  }
}

class AsyncBootProvider extends ServiceProvider {
  bootCalled = false;

  override register(): void {}

  override async boot(): Promise<void> {
    await Promise.resolve();
    this.bootCalled = true;
  }
}

describe('Application', () => {
  let app: Application;

  beforeEach(() => {
    Application.clearInstance();
    app = new Application('/project/root');
  });

  afterEach(() => {
    Application.clearInstance();
  });

  describe('constructor', () => {
    it('should register itself under the "app" token', () => {
      expect(app.make('app')).toBe(app);
    });

    it('should use process.cwd() as the default base path', () => {
      Application.clearInstance();
      const defaultApp = new Application();
      expect(defaultApp.getBasePath()).toBe(process.cwd());
      Application.clearInstance();
    });
  });

  describe('getBasePath()', () => {
    it('should return the path passed to the constructor', () => {
      expect(app.getBasePath()).toBe('/project/root');
    });
  });

  describe('getInstance()', () => {
    it('should return the most recently created Application', () => {
      expect(Application.getInstance()).toBe(app);
    });

    it('should throw ApplicationNotInitializedException when no instance exists', () => {
      Application.clearInstance();
      expect(() => Application.getInstance()).toThrow(ApplicationNotInitializedException);
    });
  });

  describe('register()', () => {
    it('should call register() on the provider immediately', () => {
      const provider = new StubProvider(app);
      app.register(provider);
      expect(app.make<{ value: number }>('stub').value).toBe(42);
    });

    it('should be chainable', () => {
      const result = app.register(new StubProvider(app));
      expect(result).toBe(app);
    });

    it('should collect providers for the boot phase', async () => {
      const provider = new BootableProvider(app);
      app.register(provider);
      await app.boot();
      expect(provider.bootCalled).toBe(true);
    });
  });

  describe('boot()', () => {
    it('should call boot() on every registered provider', async () => {
      const p1 = new BootableProvider(app);
      const p2 = new BootableProvider(app);
      app.register(p1).register(p2);
      await app.boot();
      expect(p1.bootCalled).toBe(true);
      expect(p2.bootCalled).toBe(true);
    });

    it('should support async boot() providers', async () => {
      const provider = new AsyncBootProvider(app);
      app.register(provider);
      await app.boot();
      expect(provider.bootCalled).toBe(true);
    });

    it('should be idempotent — calling boot() twice does not re-boot providers', async () => {
      const bootFn = vi.fn();
      class SpyProvider extends ServiceProvider {
        override register(): void {}
        override boot(): void {
          bootFn();
        }
      }
      app.register(new SpyProvider(app));
      await app.boot();
      await app.boot();
      expect(bootFn).toHaveBeenCalledTimes(1);
    });

    it('should set booted to true', async () => {
      expect(app.booted).toBe(false);
      await app.boot();
      expect(app.booted).toBe(true);
    });
  });
});

describe('ServiceProvider', () => {
  it('should provide a no-op default boot()', () => {
    Application.clearInstance();
    const application = new Application();
    const provider = new StubProvider(application);
    expect(() => provider.boot()).not.toThrow();
    Application.clearInstance();
  });
});
