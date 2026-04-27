import type { AuthUser } from '@faberjs/http';

export interface AuthConfig {
  readonly secret: string;
  readonly expiresIn: string;
  readonly algorithm?: 'HS256' | 'HS384' | 'HS512';
}

export interface JwtPayload {
  readonly sub: string | number;
  readonly iat: number;
  readonly exp: number;
  readonly [key: string]: unknown;
}

export interface UserProviderContract {
  findByCredentials(credentials: Record<string, unknown>): Promise<AuthUser | null>;
  findById(id: string | number): Promise<AuthUser | null>;
}

export interface GuardContract {
  attempt(credentials: Record<string, unknown>): Promise<string | null>;
  user(token: string): Promise<AuthUser | null>;
  check(token: string): Promise<boolean>;
  id(token: string): Promise<string | number | null>;
}

export interface GateContract {
  registerPolicy<T extends object>(
    modelClass: { prototype: T },
    policyClass: new () => PolicyContract,
  ): void;
  allows(ability: string, user: AuthUser | null, model?: unknown): Promise<boolean>;
  denies(ability: string, user: AuthUser | null, model?: unknown): Promise<boolean>;
}

export interface PolicyContract {
  before?(user: AuthUser, ability: string): boolean | undefined | Promise<boolean | undefined>;
}
