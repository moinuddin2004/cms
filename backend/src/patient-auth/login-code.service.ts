import { createHash, randomInt, timingSafeEqual } from 'crypto';
import {
  Inject,
  Injectable,
  Logger,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { MailService } from 'src/common/services/mail.service';
import { PatientLoginCode } from './entities/patient-login-code.entity';
import {
  PATIENT_CODE_PEPPER,
  PATIENT_LIMITS,
  readPatientLimits,
  type PatientLimits,
} from './patient-config';

const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_CODE_ATTEMPTS = 5;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const codeInvalid = () =>
  new UnauthorizedException({
    code: 'CODE_INVALID',
    message: 'The code is invalid or has expired',
  });

/** Emailed 6-digit sign-in codes: hashed, 10 min, 5 attempts, single use (03 §3 rule 6). */
@Injectable()
export class LoginCodeService {
  constructor(
    @InjectRepository(PatientLoginCode)
    private readonly codes: Repository<PatientLoginCode>,
    private readonly mail: MailService,
    @Inject(PATIENT_CODE_PEPPER) private readonly pepper: string,
    @Optional()
    @Inject(PATIENT_LIMITS)
    private readonly limits: PatientLimits = readPatientLimits(),
  ) {}

  private readonly log = new Logger(LoginCodeService.name);
  /** Per-IP sends per 24 h (memory only: resets on restart, fine for one `all` process). */
  private readonly ipDay = new Map<
    string,
    { count: number; resetAt: number }
  >();

  private ipOverCeiling(ip: string | null | undefined): boolean {
    if (!ip) return false;
    const now = Date.now();
    const hit = this.ipDay.get(ip);
    if (!hit || hit.resetAt <= now) {
      this.ipDay.set(ip, { count: 1, resetAt: now + DAY_MS });
      if (this.ipDay.size > 5000) {
        for (const [k, v] of this.ipDay)
          if (v.resetAt <= now) this.ipDay.delete(k);
      }
      return this.limits.loginCodesPerIpPerDay < 1;
    }
    hit.count += 1;
    return hit.count > this.limits.loginCodesPerIpPerDay;
  }

  /**
   * Platform-wide and per-IP ceilings on login-code emails (audit M8): login codes are account
   * emails and skip `EMAIL_DAILY_CAP`, so without this a few IPs could use up the SMTP quota for
   * every clinic. Over a cap → no email and no row, the caller still answers `{ sent: true }`.
   */
  private async overSendCap(ip: string | null | undefined): Promise<boolean> {
    if (this.ipOverCeiling(ip)) {
      this.log.warn('login-code send refused: per-IP daily ceiling');
      return true;
    }
    const now = Date.now();
    const [hour, day] = await Promise.all([
      this.codes.count({
        where: { createdAt: MoreThan(new Date(now - HOUR_MS)) },
      }),
      this.codes.count({
        where: { createdAt: MoreThan(new Date(now - DAY_MS)) },
      }),
    ]);
    if (
      hour >= this.limits.loginCodesPerHour ||
      day >= this.limits.loginCodesPerDay
    ) {
      this.log.warn('login-code send refused: platform cap reached');
      return true;
    }
    return false;
  }

  /** Failed guesses for `email` in the last 24 h (every verify burns one attempt on its code). */
  private async failedAttempts24h(email: string): Promise<number> {
    const n = await this.codes.sum('attempts', {
      email,
      createdAt: MoreThan(new Date(Date.now() - DAY_MS)),
    });
    return n ?? 0;
  }

  hash(code: string): string {
    return createHash('sha256')
      .update(code + this.pepper)
      .digest('hex');
  }

  /** Create and mail a code. Callers always answer `{ sent: true }`. */
  async start(rawEmail: string, ip?: string | null): Promise<void> {
    const email = normalizeEmail(rawEmail);
    if (await this.overSendCap(ip)) return;
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    // Only the newest code may be used: close earlier open ones.
    await this.closeOpen(email);
    await this.codes.save(
      this.codes.create({
        email,
        codeHash: this.hash(code),
        attempts: 0,
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
        usedAt: null,
      }),
    );
    await this.mail.sendLoginCode(email, code);
  }

  /** Consume the latest code of `email`. Every failure → `CODE_INVALID`. */
  async verify(rawEmail: string, code: string): Promise<void> {
    const email = normalizeEmail(rawEmail);
    // Long-term lockout on top of the 5-per-code and in-memory limits (audit M7).
    if ((await this.failedAttempts24h(email)) > this.limits.failedVerifyPer24h)
      throw codeInvalid();
    const row = await this.codes.findOne({
      where: { email, usedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      order: { createdAt: 'DESC' },
    });
    if (!row || row.attempts >= MAX_CODE_ATTEMPTS) throw codeInvalid();

    // Claim one attempt atomically so parallel guesses cannot exceed the limit.
    const claim = await this.codes
      .createQueryBuilder()
      .update(PatientLoginCode)
      .set({ attempts: () => 'attempts + 1' })
      .where(
        'id = :id AND attempts < :max AND used_at IS NULL AND expires_at > now()',
        { id: row.id, max: MAX_CODE_ATTEMPTS },
      )
      .returning('id')
      .execute();
    if (!(claim.raw as unknown[] | undefined)?.length) throw codeInvalid();

    const expected = Buffer.from(row.codeHash, 'hex');
    const given = Buffer.from(this.hash(code), 'hex');
    if (expected.length !== given.length || !timingSafeEqual(expected, given))
      throw codeInvalid();

    // Single use: only the request that flips `used_at` wins.
    const res = await this.codes.update(
      { id: row.id, usedAt: IsNull() },
      { usedAt: new Date() },
    );
    if (!res.affected) throw codeInvalid();
    await this.closeOpen(email);
  }

  /** Mark every open (unused) code of `email` as used. */
  private async closeOpen(email: string): Promise<void> {
    await this.codes.update(
      { email, usedAt: IsNull() },
      { usedAt: new Date() },
    );
  }
}
