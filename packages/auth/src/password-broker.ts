import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { AuthUser } from '@faber-js/http';
import type { UserProviderContract } from './types';

export const PASSWORD_RESET_SENT = 'passwords.sent';
export const PASSWORD_RESET_RESET = 'passwords.reset';
export const PASSWORD_RESET_INVALID_USER = 'passwords.user';
export const PASSWORD_RESET_INVALID_TOKEN = 'passwords.token';
export const PASSWORD_RESET_THROTTLED = 'passwords.throttled';

export type PasswordResetStatus =
  | typeof PASSWORD_RESET_SENT
  | typeof PASSWORD_RESET_RESET
  | typeof PASSWORD_RESET_INVALID_USER
  | typeof PASSWORD_RESET_INVALID_TOKEN
  | typeof PASSWORD_RESET_THROTTLED;

export interface PasswordBrokerConfig {
  expireMinutes?: number;
  throttleMinutes?: number;
}

export type ResetMailer = (user: AuthUser, token: string, resetUrl: string) => Promise<void>;
export type ResetCallback = (user: AuthUser, password: string) => Promise<void>;

interface TokenRecord {
  email: string;
  token: string;
  created_at: string;
}

export class PasswordBroker {
  readonly #provider: UserProviderContract;
  readonly #expireMinutes: number;
  readonly #throttleMinutes: number;
  #mailer: ResetMailer | null = null;
  #resetUrlFactory: ((token: string, email: string) => string) | null = null;

  constructor(provider: UserProviderContract, config: PasswordBrokerConfig = {}) {
    this.#provider = provider;
    this.#expireMinutes =
      config.expireMinutes ?? Number(process.env['PASSWORD_RESET_EXPIRE'] ?? 60);
    this.#throttleMinutes =
      config.throttleMinutes ?? Number(process.env['PASSWORD_RESET_THROTTLE'] ?? 1);
  }

  setMailer(mailer: ResetMailer): this {
    this.#mailer = mailer;
    return this;
  }

  setResetUrlFactory(factory: (token: string, email: string) => string): this {
    this.#resetUrlFactory = factory;
    return this;
  }

  async sendResetLink(credentials: { email: string }): Promise<PasswordResetStatus> {
    const user = await this.#provider.findByCredentials({ email: credentials.email });
    if (!user) return PASSWORD_RESET_INVALID_USER;

    const email = String(user.email ?? credentials.email);

    if (await this.#recentlyCreated(email)) return PASSWORD_RESET_THROTTLED;

    const token = randomBytes(32).toString('hex');
    await this.#storeToken(email, token);

    const resetUrl = this.#resetUrlFactory
      ? this.#resetUrlFactory(token, email)
      : `${process.env['APP_URL'] ?? ''}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

    if (this.#mailer) {
      await this.#mailer(user, token, resetUrl);
    } else {
      await this.#sendDefaultMail(user, token, resetUrl);
    }

    return PASSWORD_RESET_SENT;
  }

  async reset(
    credentials: { email: string; token: string; password: string },
    callback: ResetCallback,
  ): Promise<PasswordResetStatus> {
    const user = await this.#provider.findByCredentials({ email: credentials.email });
    if (!user) return PASSWORD_RESET_INVALID_USER;

    const email = String(user.email ?? credentials.email);
    const valid = await this.#validateToken(email, credentials.token);
    if (!valid) return PASSWORD_RESET_INVALID_TOKEN;

    await callback(user, credentials.password);
    await this.#deleteToken(email);

    return PASSWORD_RESET_RESET;
  }

  async #storeToken(email: string, plainToken: string): Promise<void> {
    const hashed = createHash('sha256').update(plainToken).digest('hex');
    const knex = await this.#getKnex();
    await knex('password_reset_tokens').where({ email }).delete();
    await knex('password_reset_tokens').insert({
      email,
      token: hashed,
      created_at: new Date().toISOString(),
    });
  }

  async #validateToken(email: string, plainToken: string): Promise<boolean> {
    const knex = await this.#getKnex();
    const record = (await knex('password_reset_tokens').where({ email }).first()) as
      | TokenRecord
      | undefined;
    if (!record) return false;

    const createdAt = new Date(record.created_at).getTime();
    const expiredAt = createdAt + this.#expireMinutes * 60 * 1000;
    if (Date.now() > expiredAt) return false;

    const expected = createHash('sha256').update(plainToken).digest('hex');
    const storedBuf = Buffer.from(record.token, 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    if (storedBuf.length !== expectedBuf.length) return false;

    return timingSafeEqual(storedBuf, expectedBuf);
  }

  async #recentlyCreated(email: string): Promise<boolean> {
    const knex = await this.#getKnex();
    const record = (await knex('password_reset_tokens').where({ email }).first()) as
      | TokenRecord
      | undefined;
    if (!record) return false;

    const createdAt = new Date(record.created_at).getTime();
    const throttleMs = this.#throttleMinutes * 60 * 1000;
    return Date.now() - createdAt < throttleMs;
  }

  async #deleteToken(email: string): Promise<void> {
    const knex = await this.#getKnex();
    await knex('password_reset_tokens').where({ email }).delete();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async #getKnex(): Promise<any> {
    const { Application } = await import('@faber-js/core');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Application.getInstance().make<any>('db');
  }

  async #sendDefaultMail(user: AuthUser, _token: string, resetUrl: string): Promise<void> {
    try {
      // Dynamic import to keep @faber-js/mail as an optional dependency.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mailPkg = await (Function('m', 'return import(m)') as (m: string) => Promise<any>)(
        '@faber-js/mail',
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Mail = mailPkg.Mail as { send(m: any): Promise<void> };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Mailable = mailPkg.Mailable as new () => any;

      const expireMinutes = this.#expireMinutes;
      class ResetPasswordMail extends Mailable {
        build(): void {
          const email = String(user.email ?? '');
          const name = String((user as Record<string, unknown>)['name'] ?? email);
          this.to(email)
            .subject('Reset Your Password')
            .html(
              `<p>Hello ${name},</p>` +
                `<p>You requested a password reset. Click the link below to set a new password:</p>` +
                `<p><a href="${resetUrl}">${resetUrl}</a></p>` +
                `<p>This link expires in ${expireMinutes} minutes.</p>` +
                `<p>If you didn't request this, ignore this email.</p>`,
            );
        }
      }

      await Mail.send(new ResetPasswordMail());
    } catch {
      // @faber-js/mail not installed or not configured — silently skip.
      // Register a custom mailer via PasswordBroker.setMailer() for production use.
    }
  }
}
