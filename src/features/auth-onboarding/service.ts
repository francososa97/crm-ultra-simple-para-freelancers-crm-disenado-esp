// AuthService: signup + login via email/password OR magic link.
// No team flows, no roles — a single freelancer per account.
//
// Security notes:
//  - Passwords are hashed with scrypt + a per-user random salt.
//  - Comparisons use timingSafeEqual to avoid timing side-channels.
//  - Magic-link raw tokens are never stored; only their SHA-256 hash is.

import {
  randomBytes,
  randomUUID,
  scrypt as scryptCb,
  timingSafeEqual,
  createHash,
} from 'node:crypto';
import { promisify } from 'node:util';
import {
  AuthError,
  type Clock,
  type MagicLinkRepository,
  type MagicLinkToken,
  type Session,
  type User,
  type UserRepository,
} from './types';

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

const SCRYPT_KEYLEN = 64;
const SALT_BYTES = 16;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const MAGIC_LINK_TTL_MS = 1000 * 60 * 15; // 15 minutes
const MIN_PASSWORD_LENGTH = 8;

// Pragmatic email check: exactly one @, non-empty local and domain-with-dot.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export interface SystemClock extends Clock {}
const defaultClock: Clock = { now: () => new Date() };

export interface AuthServiceDeps {
  users: UserRepository;
  magicLinks: MagicLinkRepository;
  clock?: Clock;
}

/** Result of requesting a magic link: the raw token to embed in the emailed URL. */
export interface MagicLinkChallenge {
  readonly userId: string;
  readonly rawToken: string;
  readonly expiresAt: Date;
}

export class AuthService {
  private readonly users: UserRepository;
  private readonly magicLinks: MagicLinkRepository;
  private readonly clock: Clock;

  constructor(deps: AuthServiceDeps) {
    this.users = deps.users;
    this.magicLinks = deps.magicLinks;
    this.clock = deps.clock ?? defaultClock;
  }

  /** Create a new account with email + password, returning an active session. */
  async signup(email: string, password: string): Promise<Session> {
    const normalized = this.assertValidEmail(email);
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new AuthError(
        'WEAK_PASSWORD',
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
    }
    if (await this.users.findByEmail(normalized)) {
      throw new AuthError('EMAIL_TAKEN', 'An account with this email already exists.');
    }

    const passwordHash = await this.hashPassword(password);
    const user: User = {
      id: randomUUID(),
      email: normalized,
      passwordHash,
      createdAt: this.clock.now(),
    };
    await this.users.create(user);
    return this.issueSession(user.id);
  }

  /** Authenticate with email + password. */
  async login(email: string, password: string): Promise<Session> {
    const normalized = this.assertValidEmail(email);
    const user = await this.users.findByEmail(normalized);

    // Run a hash regardless of user existence to keep timing uniform.
    const ok =
      user?.passwordHash != null
        ? await this.verifyPassword(password, user.passwordHash)
        : await this.verifyPassword(password, await this.hashPassword('__decoy__'), true);

    if (!user || !ok) {
      throw new AuthError('INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }
    return this.issueSession(user.id);
  }

  /**
   * Begin a passwordless login. Creates the account on first use so magic-link
   * signup and login share one entry point. The caller emails `rawToken`.
   */
  async requestMagicLink(email: string): Promise<MagicLinkChallenge> {
    const normalized = this.assertValidEmail(email);
    let user = await this.users.findByEmail(normalized);
    if (!user) {
      user = await this.users.create({
        id: randomUUID(),
        email: normalized,
        passwordHash: null,
        createdAt: this.clock.now(),
      });
    }

    const rawToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(this.clock.now().getTime() + MAGIC_LINK_TTL_MS);
    const record: MagicLinkToken = {
      tokenHash: sha256(rawToken),
      userId: user.id,
      expiresAt,
      consumedAt: null,
    };
    await this.magicLinks.save(record);
    return { userId: user.id, rawToken, expiresAt };
  }

  /** Complete a passwordless login by redeeming a single-use magic-link token. */
  async verifyMagicLink(rawToken: string): Promise<Session> {
    const record = await this.magicLinks.findByHash(sha256(rawToken));
    if (!record || record.consumedAt !== null) {
      throw new AuthError('INVALID_TOKEN', 'This magic link is invalid or already used.');
    }
    if (record.expiresAt.getTime() <= this.clock.now().getTime()) {
      throw new AuthError('TOKEN_EXPIRED', 'This magic link has expired.');
    }
    await this.magicLinks.markConsumed(record.tokenHash, this.clock.now());
    return this.issueSession(record.userId);
  }

  // ---- internals -------------------------------------------------------

  private assertValidEmail(email: string): string {
    const normalized = normalizeEmail(email);
    if (!EMAIL_RE.test(normalized)) {
      throw new AuthError('INVALID_EMAIL', 'Please provide a valid email address.');
    }
    return normalized;
  }

  private issueSession(userId: string): Session {
    return {
      token: randomBytes(32).toString('base64url'),
      userId,
      expiresAt: new Date(this.clock.now().getTime() + SESSION_TTL_MS),
    };
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES).toString('hex');
    const derived = await scrypt(password, salt, SCRYPT_KEYLEN);
    return `${salt}:${derived.toString('hex')}`;
  }

  private async verifyPassword(
    password: string,
    stored: string,
    isDecoy = false,
  ): Promise<boolean> {
    const [salt, hashHex] = stored.split(':');
    if (!salt || !hashHex) return false;
    const derived = await scrypt(password, salt, SCRYPT_KEYLEN);
    const expected = Buffer.from(hashHex, 'hex');
    if (derived.length !== expected.length) return false;
    const matches = timingSafeEqual(derived, expected);
    return isDecoy ? false : matches;
  }
}

// ---- In-memory repositories (dev/testing; swap for a DB in production) ----

export class InMemoryUserRepository implements UserRepository {
  private readonly byId = new Map<string, User>();
  private readonly byEmail = new Map<string, string>();

  async findByEmail(email: string): Promise<User | null> {
    const id = this.byEmail.get(normalizeEmail(email));
    return id ? (this.byId.get(id) ?? null) : null;
  }

  async findById(id: string): Promise<User | null> {
    return this.byId.get(id) ?? null;
  }

  async create(user: User): Promise<User> {
    this.byId.set(user.id, user);
    this.byEmail.set(user.email, user.id);
    return user;
  }
}

export class InMemoryMagicLinkRepository implements MagicLinkRepository {
  private readonly byHash = new Map<string, MagicLinkToken>();

  async save(token: MagicLinkToken): Promise<void> {
    this.byHash.set(token.tokenHash, token);
  }

  async findByHash(tokenHash: string): Promise<MagicLinkToken | null> {
    return this.byHash.get(tokenHash) ?? null;
  }

  async markConsumed(tokenHash: string, consumedAt: Date): Promise<void> {
    const existing = this.byHash.get(tokenHash);
    if (existing) existing.consumedAt = consumedAt;
  }
}
