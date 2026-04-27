import type { AuthUser } from '@faberjs/http';
import type { UserProviderContract } from './types';

export abstract class UserProvider implements UserProviderContract {
  abstract findByCredentials(credentials: Record<string, unknown>): Promise<AuthUser | null>;
  abstract findById(id: string | number): Promise<AuthUser | null>;
}
