import { Application } from '@faberjs/core';
import type { AuthUser } from '@faberjs/http';
import type { GuardContract } from './types';

function resolveGuard(): GuardContract {
  return Application.getInstance().make<GuardContract>('auth.guard');
}

export const Auth = {
  async attempt(credentials: Record<string, unknown>): Promise<string | null> {
    return resolveGuard().attempt(credentials);
  },

  async user(token: string): Promise<AuthUser | null> {
    return resolveGuard().user(token);
  },

  async check(token: string): Promise<boolean> {
    return resolveGuard().check(token);
  },

  async id(token: string): Promise<string | number | null> {
    return resolveGuard().id(token);
  },

  guard(name: string): GuardContract {
    return Application.getInstance().make<GuardContract>(`auth.guard.${name}`);
  },
} as const;
