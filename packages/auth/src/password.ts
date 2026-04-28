import type { AuthUser } from '@faber-js/http';
import type { UserProviderContract } from './types';
import {
  PasswordBroker,
  type PasswordBrokerConfig,
  type PasswordResetStatus,
  type ResetCallback,
  type ResetMailer,
} from './password-broker';

export class Password {
  static #broker: PasswordBroker | null = null;

  static setBroker(broker: PasswordBroker): void {
    this.#broker = broker;
  }

  static configure(provider: UserProviderContract, config?: PasswordBrokerConfig): PasswordBroker {
    this.#broker = new PasswordBroker(provider, config);
    return this.#broker;
  }

  static broker(): PasswordBroker {
    if (!this.#broker) {
      throw new Error(
        'Password broker not configured. Call Password.configure() or register PasswordServiceProvider.',
      );
    }
    return this.#broker;
  }

  static sendResetLink(credentials: { email: string }): Promise<PasswordResetStatus> {
    return this.broker().sendResetLink(credentials);
  }

  static reset(
    credentials: { email: string; token: string; password: string },
    callback: ResetCallback,
  ): Promise<PasswordResetStatus> {
    return this.broker().reset(credentials, callback);
  }

  static setMailer(mailer: ResetMailer): void {
    this.broker().setMailer(mailer);
  }

  static setResetUrlFactory(factory: (token: string, email: string) => string): void {
    this.broker().setResetUrlFactory(factory);
  }

  /** Status constants — mirror Laravel's Password constants */
  static readonly RESET_LINK_SENT = 'passwords.sent' as const;
  static readonly PASSWORD_RESET = 'passwords.reset' as const;
  static readonly INVALID_USER = 'passwords.user' as const;
  static readonly INVALID_TOKEN = 'passwords.token' as const;
  static readonly RESET_THROTTLED = 'passwords.throttled' as const;
}

export type { ResetCallback, ResetMailer, PasswordResetStatus };
export interface PasswordResetCredentials {
  email: string;
  token: string;
  password: string;
}

/** Extend UserProvider to support password reset if needed. */
export interface PasswordResettable {
  findByEmail(email: string): Promise<AuthUser | null>;
}
