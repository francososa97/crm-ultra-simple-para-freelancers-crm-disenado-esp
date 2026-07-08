// Domain types for the Auth & Onboarding feature.
// Kept intentionally minimal: no teams, no roles — a freelancer works solo.

/** Unique identifier for a user (UUID v4 string). */
export type UserId = string;

/** A registered freelancer account. */
export interface User {
  readonly id: UserId;
  readonly email: string;
  /** scrypt-derived hash, or null when the account only uses magic links. */
  readonly passwordHash: string | null;
  readonly createdAt: Date;
}

/** An authenticated session returned after a successful login/signup. */
export interface Session {
  readonly token: string;
  readonly userId: UserId;
  readonly expiresAt: Date;
}

/** A single-use, time-limited magic-link token. */
export interface MagicLinkToken {
  /** Hash of the raw token; the raw value is only ever sent to the user. */
  readonly tokenHash: string;
  readonly userId: UserId;
  readonly expiresAt: Date;
  consumedAt: Date | null;
}

/** Machine-readable error codes for auth failures. */
export type AuthErrorCode =
  | 'INVALID_EMAIL'
  | 'WEAK_PASSWORD'
  | 'EMAIL_TAKEN'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED'
  | 'USER_NOT_FOUND';

export class AuthError extends Error {
  public readonly code: AuthErrorCode;
  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

/** Persistence abstraction for users. */
export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: UserId): Promise<User | null>;
  create(user: User): Promise<User>;
}

/** Persistence abstraction for magic-link tokens. */
export interface MagicLinkRepository {
  save(token: MagicLinkToken): Promise<void>;
  findByHash(tokenHash: string): Promise<MagicLinkToken | null>;
  markConsumed(tokenHash: string, consumedAt: Date): Promise<void>;
}

/** Injectable clock, so token expiry can be tested deterministically. */
export interface Clock {
  now(): Date;
}
