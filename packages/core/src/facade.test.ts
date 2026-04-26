import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Application } from './application';
import { Facade } from './facade';

interface MailerContract {
  send(to: string): string;
}

class RealMailer implements MailerContract {
  send(to: string): string {
    return `sent to ${to}`;
  }
}

class MockMailer implements MailerContract {
  send(to: string): string {
    return `mock:${to}`;
  }
}

class Mail extends Facade {
  protected static override getFacadeAccessor(): string {
    return 'mailer';
  }

  static send(to: string): string {
    return this.resolveRoot<MailerContract>().send(to);
  }
}

describe('Facade', () => {
  let app: Application;

  beforeEach(() => {
    Application.clearInstance();
    app = new Application();
    Facade.clearSwaps();
  });

  afterEach(() => {
    Application.clearInstance();
    Facade.clearSwaps();
  });

  describe('resolveRoot()', () => {
    it('should resolve the underlying instance from the container', () => {
      app.instance('mailer', new RealMailer());
      expect(Mail.send('alice@example.com')).toBe('sent to alice@example.com');
    });
  });

  describe('swap()', () => {
    it('should replace the underlying instance with the swapped one', () => {
      app.instance('mailer', new RealMailer());
      Facade.swap('mailer', new MockMailer());
      expect(Mail.send('bob@example.com')).toBe('mock:bob@example.com');
    });
  });

  describe('clearSwaps()', () => {
    it('should remove all swapped instances so the container is used again', () => {
      app.instance('mailer', new RealMailer());
      Facade.swap('mailer', new MockMailer());
      Facade.clearSwaps();
      expect(Mail.send('carol@example.com')).toBe('sent to carol@example.com');
    });
  });

  describe('getFacadeAccessor()', () => {
    it('should throw when a subclass does not override getFacadeAccessor()', () => {
      class BrokenFacade extends Facade {}
      expect(() => BrokenFacade['getFacadeAccessor']()).toThrow();
    });
  });
});
