// ── JWT auth ──────────────────────────────────────────────────────────────────
export { Auth } from './auth';
export { AuthMiddleware } from './auth-middleware';
export { AuthServiceProvider } from './auth-service-provider';
export { JwtGuard } from './jwt-guard';

// ── API token auth ────────────────────────────────────────────────────────────
export { TokenAuth } from './token-auth';
export { TokenAuthServiceProvider } from './token-auth-service-provider';
export { TokenGuard } from './token-guard';
export { TokenMiddleware } from './token-middleware';
export { PersonalAccessToken } from './personal-access-token';
export type { NewTokenResult } from './token-guard';

// ── Authorization ─────────────────────────────────────────────────────────────
export { Gate } from './gate';
export { Policy } from './policy';

// ── Password reset ────────────────────────────────────────────────────────────
export { Password } from './password';
export { PasswordBroker } from './password-broker';
export { PasswordResetToken } from './password-reset-token';
export type {
  PasswordResetStatus,
  ResetCallback,
  ResetMailer,
  PasswordResetCredentials,
} from './password';

// ── Shared ────────────────────────────────────────────────────────────────────
export { UserProvider } from './user-provider';
export type {
  AuthConfig,
  GateContract,
  GuardContract,
  JwtPayload,
  PolicyContract,
  TokenConfig,
  UserProviderContract,
} from './types';
