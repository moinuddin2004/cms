import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import {
  Inject,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { PatientSession } from './entities/patient-session.entity';
import { PatientSessionEvents } from './patient-session-events';
import {
  PATIENT_LIMITS,
  readPatientLimits,
  type PatientLimits,
} from './patient-config';

const REFRESH_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

function sameHash(a: string | null | undefined, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

const invalid = () =>
  new UnauthorizedException({
    code: 'SESSION_INVALID',
    message: 'Please sign in again',
  });

/**
 * Patient sessions. Refresh token = `"<sessionId>:<base64url 32 bytes>"`; only
 * sha256 of the random part is stored (03 §3 rule 5). Every refresh rotates it;
 * presenting the previous token again revokes the whole session (theft signal).
 */
@Injectable()
export class PatientSessionService {
  constructor(
    @InjectRepository(PatientSession)
    private readonly sessions: Repository<PatientSession>,
    @Optional() private readonly events?: PatientSessionEvents,
    @Optional()
    @Inject(PATIENT_LIMITS)
    private readonly limits: PatientLimits = readPatientLimits(),
  ) {}

  /**
   * Next expiry: 60 days from now, never past the absolute lifetime (`sessionMaxDays` from
   * `created_at`, audit L6) — a stolen token cannot be kept alive forever by rotating it.
   */
  private nextExpiry(now: Date, createdAt: Date | undefined): Date {
    const rolling = now.getTime() + REFRESH_DAYS * DAY_MS;
    if (!createdAt) return new Date(rolling);
    const cap = createdAt.getTime() + this.limits.sessionMaxDays * DAY_MS;
    return new Date(Math.min(rolling, cap));
  }

  async create(
    accountId: string,
    meta: { ip?: string | null; deviceLabel?: string | null } = {},
  ): Promise<{ session: PatientSession; refreshToken: string }> {
    const id = randomUUID();
    const part = randomBytes(32).toString('base64url');
    const now = new Date();
    const session = await this.sessions.save(
      this.sessions.create({
        id,
        accountId,
        refreshTokenHash: sha256(part),
        previousTokenHash: null,
        deviceLabel: meta.deviceLabel?.slice(0, 80) || null,
        ip: meta.ip?.slice(0, 64) || null,
        expiresAt: new Date(now.getTime() + REFRESH_DAYS * DAY_MS),
        lastUsedAt: now,
        revokedAt: null,
      }),
    );
    return { session, refreshToken: `${id}:${part}` };
  }

  /** Rotate a refresh token. Any failure → `SESSION_INVALID`. */
  async rotate(
    refreshToken: string | undefined,
  ): Promise<{ session: PatientSession; refreshToken: string }> {
    const sep = (refreshToken ?? '').indexOf(':');
    if (!refreshToken || sep < 0) throw invalid();
    const id = refreshToken.slice(0, sep);
    const part = refreshToken.slice(sep + 1);
    if (!UUID_RE.test(id) || !part || part.length > 100) throw invalid();

    const session = await this.sessions.findOne({ where: { id } });
    const now = new Date();
    if (!session || session.revokedAt || session.expiresAt <= now)
      throw invalid();

    const presented = sha256(part);
    if (sameHash(session.previousTokenHash, presented)) {
      // A rotated token came back: someone else holds a copy. Kill the session.
      await this.revokeSession(id, session.accountId);
      throw invalid();
    }
    if (!sameHash(session.refreshTokenHash, presented)) throw invalid();

    const nextPart = randomBytes(32).toString('base64url');
    const expiresAt = this.nextExpiry(now, session.createdAt);
    if (expiresAt <= now) throw invalid();
    // Compare-and-swap on the current hash: two parallel refreshes cannot both win.
    const res = await this.sessions.update(
      { id, refreshTokenHash: session.refreshTokenHash, revokedAt: IsNull() },
      {
        refreshTokenHash: sha256(nextPart),
        previousTokenHash: session.refreshTokenHash,
        lastUsedAt: now,
        expiresAt,
      },
    );
    if (!res.affected) {
      // Lost the race: someone else rotated first. Re-read — if our token is now the PREVIOUS
      // one, two holders used the same token, so treat it as theft and kill the session (L5).
      const fresh = await this.sessions.findOne({ where: { id } });
      if (
        fresh &&
        !fresh.revokedAt &&
        sameHash(fresh.previousTokenHash, presented)
      ) {
        await this.revokeSession(id, session.accountId);
      }
      throw invalid();
    }

    return {
      session: {
        ...session,
        refreshTokenHash: sha256(nextPart),
        previousTokenHash: session.refreshTokenHash,
        lastUsedAt: now,
        expiresAt,
      },
      refreshToken: `${id}:${nextPart}`,
    };
  }

  /** Logout: revoke the session the token belongs to (idempotent, silent). */
  async revokeByToken(refreshToken: string | undefined): Promise<void> {
    const id = (refreshToken ?? '').split(':')[0];
    if (!UUID_RE.test(id)) return;
    const session = await this.sessions.findOne({ where: { id } });
    if (!session || session.revokedAt) return;
    const presented = sha256(refreshToken!.slice(id.length + 1));
    if (
      sameHash(session.refreshTokenHash, presented) ||
      sameHash(session.previousTokenHash, presented)
    ) {
      await this.revokeSession(id, session.accountId);
    }
  }

  /**
   * Revoke one session and drop what the privacy policy says goes with it: the IP and the device
   * label (audit M9). Ends the socket too.
   */
  private async revokeSession(id: string, accountId: string): Promise<void> {
    await this.sessions.update(
      { id },
      { revokedAt: new Date(), ip: null, deviceLabel: null },
    );
    this.events?.revoked({ accountId, sessionId: id });
  }

  /** Is this session usable right now? (strategy check) */
  async isAlive(sessionId: string, accountId: string): Promise<boolean> {
    const n = await this.sessions.count({
      where: {
        id: sessionId,
        accountId,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });
    return n > 0;
  }
}
