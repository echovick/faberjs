import { SignJWT, jwtVerify } from 'jose';
import type { AuthUser } from '@faberjs/http';
import type { AuthConfig, GuardContract, JwtPayload, UserProviderContract } from './types';

export class JwtGuard implements GuardContract {
  readonly #config: AuthConfig;
  readonly #provider: UserProviderContract;

  constructor(config: AuthConfig, provider: UserProviderContract) {
    this.#config = config;
    this.#provider = provider;
  }

  async attempt(credentials: Record<string, unknown>): Promise<string | null> {
    const user = await this.#provider.findByCredentials(credentials);
    if (!user) return null;

    const secret = new TextEncoder().encode(this.#config.secret);
    const alg = this.#config.algorithm ?? 'HS256';

    const token = await new SignJWT({ sub: String(user.id) })
      .setProtectedHeader({ alg })
      .setIssuedAt()
      .setExpirationTime(this.#config.expiresIn)
      .sign(secret);

    return token;
  }

  async user(token: string): Promise<AuthUser | null> {
    const id = await this.id(token);
    if (id === null) return null;
    return this.#provider.findById(id);
  }

  async check(token: string): Promise<boolean> {
    const id = await this.id(token);
    return id !== null;
  }

  async id(token: string): Promise<string | number | null> {
    try {
      const secret = new TextEncoder().encode(this.#config.secret);
      const { payload } = await jwtVerify(token, secret);
      const typedPayload = payload as unknown as JwtPayload;
      const sub = typedPayload.sub;
      if (sub === undefined || sub === null) return null;
      return sub;
    } catch {
      return null;
    }
  }
}
