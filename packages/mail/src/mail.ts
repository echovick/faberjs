import type { Mailable } from './mailable';
import type { Mailer } from './mailer';

class FakeMail {
  sent: Mailable[] = [];

  async send(mailable: Mailable): Promise<void> {
    this.sent.push(mailable);
  }

  assertSent(mailableClass: new (...args: unknown[]) => Mailable, count?: number): void {
    const matching = this.sent.filter((m) => m instanceof mailableClass);
    if (count !== undefined) {
      if (matching.length !== count) {
        throw new Error(
          `Expected ${mailableClass.name} to be sent ${count} time(s), but it was sent ${matching.length} time(s).`,
        );
      }
    } else if (matching.length === 0) {
      throw new Error(`Expected ${mailableClass.name} to be sent, but it was not.`);
    }
  }

  assertNotSent(mailableClass: new (...args: unknown[]) => Mailable): void {
    const matching = this.sent.filter((m) => m instanceof mailableClass);
    if (matching.length > 0) {
      throw new Error(
        `Expected ${mailableClass.name} not to be sent, but it was sent ${matching.length} time(s).`,
      );
    }
  }

  assertNothingSent(): void {
    if (this.sent.length > 0) {
      const names = this.sent.map((m) => m.constructor.name).join(', ');
      throw new Error(`Expected nothing to be sent, but the following were sent: ${names}`);
    }
  }
}

class MailPendingSend {
  constructor(
    private address: string,
    private name?: string,
  ) {}

  async send(mailable: Mailable): Promise<void> {
    mailable.to(this.address, this.name);
    await Mail.send(mailable);
  }
}

export class Mail {
  private static _instance: Mailer | null = null;
  private static _fake: FakeMail | null = null;

  static setInstance(mailer: Mailer): void {
    Mail._instance = mailer;
  }

  static async send(mailable: Mailable): Promise<void> {
    if (Mail._fake) {
      return Mail._fake.send(mailable);
    }

    if (!Mail._instance) {
      const { Mailer } = await import('./mailer');
      Mail._instance = Mailer.fromEnv();
    }

    return Mail._instance.send(mailable);
  }

  static to(address: string, name?: string): MailPendingSend {
    return new MailPendingSend(address, name);
  }

  static fake(): FakeMail {
    Mail._fake = new FakeMail();
    return Mail._fake;
  }

  static restore(): void {
    Mail._fake = null;
  }

  static assertSent(mailableClass: new (...args: unknown[]) => Mailable, count?: number): void {
    if (!Mail._fake) {
      throw new Error('Call Mail.fake() before using Mail.assertSent().');
    }
    Mail._fake.assertSent(mailableClass, count);
  }

  static assertNotSent(mailableClass: new (...args: unknown[]) => Mailable): void {
    if (!Mail._fake) {
      throw new Error('Call Mail.fake() before using Mail.assertNotSent().');
    }
    Mail._fake.assertNotSent(mailableClass);
  }

  static assertNothingSent(): void {
    if (!Mail._fake) {
      throw new Error('Call Mail.fake() before using Mail.assertNothingSent().');
    }
    Mail._fake.assertNothingSent();
  }
}
