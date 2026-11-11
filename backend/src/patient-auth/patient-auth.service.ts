import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { PatientAccountConsent } from '../patient-app/entities/patient-account-consent.entity';
import { PatientAccountIdentity } from './entities/patient-account-identity.entity';
import { PatientAccount } from './entities/patient-account.entity';
import { LoginCodeService, normalizeEmail } from './login-code.service';
import { PatientSessionService } from './patient-session.service';
import { PatientTokenService } from './patient-token.service';

export interface PatientSessionResponse {
  account: { id: string; fullName: string | null; email: string };
  accessToken: string;
  refreshToken: string;
  isNewAccount: boolean;
  needsName: boolean;
}

export interface ClientMeta {
  ip?: string | null;
  deviceLabel?: string | null;
}

const accountDisabled = () =>
  new ForbiddenException({
    code: 'ACCOUNT_DISABLED',
    message: 'This account is not available',
  });

/** Orchestrates patient sign-in: code → account → session → tokens. */
@Injectable()
export class PatientAuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly codes: LoginCodeService,
    private readonly sessions: PatientSessionService,
    private readonly tokens: PatientTokenService,
    @InjectRepository(PatientAccount)
    private readonly accounts: Repository<PatientAccount>,
  ) {}

  startEmail(email: string): Promise<void> {
    return this.codes.start(email);
  }

  async verifyEmail(
    input: {
      email: string;
      code: string;
      termsVersion: string;
      privacyVersion: string;
    },
    meta: ClientMeta,
  ): Promise<PatientSessionResponse> {
    await this.codes.verify(input.email, input.code);
    const email = normalizeEmail(input.email);

    const { account, isNew } = await this.dataSource.transaction((em) =>
      this.resolveAccount(em, email, input, meta),
    );
    return this.issue(account, isNew, meta);
  }

  async refresh(
    refreshToken: string | undefined,
  ): Promise<PatientSessionResponse> {
    const { session, refreshToken: next } =
      await this.sessions.rotate(refreshToken);
    const account = await this.accounts.findOne({
      where: { id: session.accountId, deletedAt: IsNull() },
    });
    if (!account || account.status !== 'active') {
      await this.sessions.revokeByToken(next);
      throw accountDisabled();
    }
    return this.build(account, session.id, next, false);
  }

  logout(refreshToken: string | undefined): Promise<void> {
    return this.sessions.revokeByToken(refreshToken);
  }

  private async resolveAccount(
    em: EntityManager,
    email: string,
    input: { termsVersion: string; privacyVersion: string },
    meta: ClientMeta,
  ): Promise<{ account: PatientAccount; isNew: boolean }> {
    const repo = em.getRepository(PatientAccount);
    let account = await repo
      .createQueryBuilder('a')
      .where('lower(a.email) = :email AND a.deleted_at IS NULL', { email })
      .getOne();
    let isNew = false;

    if (!account) {
      account = await repo.save(
        repo.create({
          email,
          fullName: null,
          emailVerifiedAt: new Date(),
          status: 'active',
        }),
      );
      isNew = true;
    } else if (account.status !== 'active') {
      throw accountDisabled();
    } else if (!account.emailVerifiedAt) {
      account.emailVerifiedAt = new Date();
      await repo.save(account);
    }

    await em
      .createQueryBuilder()
      .insert()
      .into(PatientAccountIdentity)
      .values({ accountId: account.id, provider: 'email', subject: email })
      .orIgnore()
      .execute();

    await this.recordConsent(em, account.id, 'terms', input.termsVersion, meta);
    await this.recordConsent(
      em,
      account.id,
      'privacy',
      input.privacyVersion,
      meta,
    );
    return { account, isNew };
  }

  private async recordConsent(
    em: EntityManager,
    accountId: string,
    kind: 'terms' | 'privacy',
    version: string,
    meta: ClientMeta,
  ): Promise<void> {
    const repo = em.getRepository(PatientAccountConsent);
    const exists = await repo.exist({ where: { accountId, kind, version } });
    if (exists) return;
    await repo.save(
      repo.create({
        accountId,
        kind,
        version,
        organizationId: null,
        ip: meta.ip?.slice(0, 64) || null,
      }),
    );
  }

  private async issue(
    account: PatientAccount,
    isNew: boolean,
    meta: ClientMeta,
  ): Promise<PatientSessionResponse> {
    const { session, refreshToken } = await this.sessions.create(
      account.id,
      meta,
    );
    return this.build(account, session.id, refreshToken, isNew);
  }

  private async build(
    account: PatientAccount,
    sessionId: string,
    refreshToken: string,
    isNewAccount: boolean,
  ): Promise<PatientSessionResponse> {
    return {
      account: {
        id: account.id,
        fullName: account.fullName,
        email: account.email,
      },
      accessToken: await this.tokens.sign(account.id, sessionId),
      refreshToken,
      isNewAccount,
      needsName: !account.fullName,
    };
  }
}
