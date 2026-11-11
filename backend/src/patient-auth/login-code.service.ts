import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { MailService } from 'src/common/services/mail.service';
import { PatientLoginCode } from './entities/patient-login-code.entity';
import { PATIENT_CODE_PEPPER } from './patient-config';

const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_CODE_ATTEMPTS = 5;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

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
  ) {}

  hash(code: string): string {
    return createHash('sha256')
      .update(code + this.pepper)
      .digest('hex');
  }

  /** Create and mail a code. Callers always answer `{ sent: true }`. */
  async start(rawEmail: string): Promise<void> {
    const email = normalizeEmail(rawEmail);
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
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
    const row = await this.codes.findOne({
      where: { email, usedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      order: { createdAt: 'DESC' },
    });
    if (!row || row.attempts >= MAX_CODE_ATTEMPTS) throw codeInvalid();

    await this.codes.increment({ id: row.id }, 'attempts', 1);

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
  }
}
