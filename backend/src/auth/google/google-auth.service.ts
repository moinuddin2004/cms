import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { Request, Response } from 'express';
import { AppLogger } from 'src/common/services/logger.service';
import { GlobalRole } from 'src/common/enums/global-role.enum';
import { User } from 'src/user/entities/user.entity';
import { AccountStatus } from 'src/user/enum/AccountStatus';
import { ClinicSetupService } from 'src/subscriptions/clinic-setup.service';
import { ClinicGateService } from 'src/clinic-access/clinic-gate.service';
import { ClinicAccessService } from 'src/clinic-access/clinic-access.service';
import { OAuthProvider } from '../entities/OAuthProvider';
import { ProviderEnum } from '../enum/ProviderEnum';
import { SecurityLogService } from '../security-log.service';
import { AuthService, LoginResponse } from '../auth.service';
import {
  GoogleIdentity,
  GoogleIdentityService,
} from './google-identity.service';
import {
  GoogleJoinRequestDto,
  GoogleRegisterDto,
  GoogleSignInDto,
} from './google-auth.dto';

/**
 * Result of "Continue with Google" on the login page. Always 200 so the web
 * app can branch without parsing error codes:
 * - `signed_in`: same payload as password login;
 * - `no_account`: nobody has this Google account — offer "create a clinic"
 *   and any clinics that take join requests from its Workspace domain;
 * - `link_required`: an account with this email signs in with a password —
 *   sign in that way once, then link Google from Settings → Sign-in methods.
 */
export type GoogleSignInResult =
  | { outcome: 'signed_in'; session: LoginResponse }
  | {
      outcome: 'no_account';
      profile: { email: string; name: string; picture: string | null };
      joinableClinics: { id: string; name: string }[];
    }
  | { outcome: 'link_required'; email: string; message: string };

export interface LoginMethods {
  hasPassword: boolean;
  google: { email: string | null; linkedAt: Date } | null;
  /** Google sign-in is set up on this server (GOOGLE_CLIENT_ID). */
  googleConfigured: boolean;
}

type Resolved =
  | { kind: 'user'; user: User }
  | { kind: 'none' }
  | { kind: 'link_required'; message: string };

/**
 * Google sign-in: identity only. Google says who the person is; which
 * clinic they open, and with what role, is decided by the app exactly as
 * for a password login. Accounts match on Google's `sub`, never on email,
 * except the first sign-in of an account that has no password (created by
 * a clinic as a Google login, or by a Google signup), which is linked to the
 * Google account with that verified email.
 */
@Injectable()
export class GoogleAuthService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly identity: GoogleIdentityService,
    private readonly authService: AuthService,
    private readonly clinicSetup: ClinicSetupService,
    private readonly gate: ClinicGateService,
    private readonly clinicAccess: ClinicAccessService,
    private readonly securityLog: SecurityLogService,
    private readonly logger: AppLogger,
  ) {}

  // ── Sign in ───────────────────────────────────────────────────────

  async signIn(
    dto: GoogleSignInDto,
    req: Request,
    res: Response,
  ): Promise<GoogleSignInResult> {
    const g = await this.identity.verify(dto.credential);
    const resolved = await this.resolveUser(g, req);

    if (resolved.kind === 'link_required') {
      return {
        outcome: 'link_required',
        email: g.email,
        message: resolved.message,
      };
    }
    if (resolved.kind === 'none') {
      return {
        outcome: 'no_account',
        profile: { email: g.email, name: g.name, picture: g.picture },
        joinableClinics: await this.gate.joinableClinics(g.hd),
      };
    }

    const session = await this.authService.issueLogin(
      resolved.user,
      req,
      res,
      dto.rememberMe ?? true,
      { method: 'google', domain: g.hd },
    );
    return { outcome: 'signed_in', session };
  }

  // ── Sign up (new clinic, Google owner) ────────────────────────────

  async register(
    dto: GoogleRegisterDto,
    req: Request,
    res: Response,
  ): Promise<LoginResponse> {
    const g = await this.identity.verify(dto.credential);
    await this.assertNoAccount(g);

    const user = await this.createGoogleUser(g);
    try {
      await this.clinicSetup.createClinicForOwner(user, {
        clinicName: dto.clinicName,
        phone: dto.phone,
      });
    } catch (err) {
      // No clinic means no usable account — don't leave a dangling login.
      await this.dataSource.getRepository(User).delete(user.uuid);
      throw err;
    }
    await this.securityLog.logOAuthLink(user.uuid, 'google', req);
    this.logger.info(
      `Google signup complete for ${g.email}`,
      GoogleAuthService.name,
    );
    // Signup signs in and stays signed in (30 days), like password signup.
    return this.authService.issueLogin(user, req, res, true, {
      method: 'google',
      domain: g.hd,
    });
  }

  // ── Join request ──────────────────────────────────────────────────

  async requestToJoin(
    dto: GoogleJoinRequestDto,
    req: Request,
    res: Response,
  ): Promise<LoginResponse> {
    const g = await this.identity.verify(dto.credential);
    const joinable = await this.gate.joinableClinics(g.hd);
    if (!joinable.some((c) => c.id === dto.organizationId)) {
      throw new BadRequestException(
        'This clinic does not take join requests from your Google account.',
      );
    }

    const resolved = await this.resolveUser(g, req);
    if (resolved.kind === 'link_required') {
      throw new ConflictException(resolved.message);
    }
    const user =
      resolved.kind === 'user' ? resolved.user : await this.createGoogleUser(g);
    if (resolved.kind === 'none') {
      await this.securityLog.logOAuthLink(user.uuid, 'google', req);
    }

    await this.clinicAccess.createJoinRequest({
      organizationId: dto.organizationId,
      userId: user.uuid,
      email: g.email,
      name: user.name || g.name,
      phone: dto.phone,
      message: dto.message,
      hd: g.hd,
    });
    // Signed in with no clinic yet: the web app shows the request status.
    return this.authService.issueLogin(user, req, res, true, {
      method: 'google',
      domain: g.hd,
    });
  }

  // ── Linking (signed in) ───────────────────────────────────────────

  async loginMethods(userId: string): Promise<LoginMethods> {
    const user = await this.dataSource
      .getRepository(User)
      .findOneBy({ uuid: userId });
    if (!user) throw new NotFoundException('User not found');
    const link = await this.links().findOneBy({
      userId,
      provider: ProviderEnum.GOOGLE,
    });
    return {
      hasPassword: !!user.password,
      google: link
        ? { email: link.email ?? null, linkedAt: link.createdAt }
        : null,
      googleConfigured: !!this.identity.clientId,
    };
  }

  async link(
    userId: string,
    credential: string,
    req: Request,
  ): Promise<LoginMethods> {
    const user = await this.dataSource
      .getRepository(User)
      .findOneBy({ uuid: userId });
    if (!user) throw new NotFoundException('User not found');
    if (user.globalRole === GlobalRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Super admin accounts sign in with email and password only.',
      );
    }
    const g = await this.identity.verify(credential);

    const bySub = await this.links().findOneBy({
      provider: ProviderEnum.GOOGLE,
      providerId: g.sub,
    });
    if (bySub && bySub.userId !== userId) {
      throw new ConflictException(
        'This Google account is already linked to another login.',
      );
    }
    if (!bySub) {
      const existing = await this.links().findOneBy({
        userId,
        provider: ProviderEnum.GOOGLE,
      });
      if (existing) {
        throw new ConflictException(
          'A Google account is already linked. Unlink it first.',
        );
      }
      await this.saveLink(this.dataSource.manager, userId, g);
      await this.securityLog.logOAuthLink(userId, 'google', req);
    }
    return this.loginMethods(userId);
  }

  async unlink(userId: string, req: Request): Promise<LoginMethods> {
    const user = await this.dataSource
      .getRepository(User)
      .findOneBy({ uuid: userId });
    if (!user) throw new NotFoundException('User not found');
    if (!user.password) {
      throw new BadRequestException(
        'Set a password first — otherwise you would have no way to sign in.',
      );
    }
    const result = await this.links().delete({
      userId,
      provider: ProviderEnum.GOOGLE,
    });
    if (result.affected) {
      await this.securityLog.logOAuthUnlink(userId, 'google', req);
    }
    return this.loginMethods(userId);
  }

  // ── Internals ─────────────────────────────────────────────────────

  private links() {
    return this.dataSource.getRepository(OAuthProvider);
  }

  /**
   * The account for this Google identity: by linked `sub`, else the
   * password-less account with this email (linked now). An account with a
   * password, or linked to a different Google account, must link from
   * Settings first.
   */
  private async resolveUser(
    g: GoogleIdentity,
    req: Request,
  ): Promise<Resolved> {
    const users = this.dataSource.getRepository(User);
    const link = await this.links().findOneBy({
      provider: ProviderEnum.GOOGLE,
      providerId: g.sub,
    });
    if (link) {
      const user = await users.findOneBy({ uuid: link.userId });
      if (!user) return { kind: 'none' };
      this.assertGoogleAllowed(user);
      return { kind: 'user', user };
    }

    const user = await users
      .createQueryBuilder('u')
      .where('LOWER(u.email) = :email', { email: g.email })
      .getOne();
    if (!user || user.status === AccountStatus.DELETED) return { kind: 'none' };
    this.assertGoogleAllowed(user);

    const otherLink = await this.links().findOneBy({
      userId: user.uuid,
      provider: ProviderEnum.GOOGLE,
    });
    if (otherLink) {
      return {
        kind: 'link_required',
        message:
          'Your account is linked to a different Google account. Sign in with that one, or with your password.',
      };
    }
    if (user.password) {
      return {
        kind: 'link_required',
        message:
          'An account with this email signs in with a password. Sign in with your password once, then link Google under Settings → Sign-in methods.',
      };
    }

    // Password-less account (clinic-created Google login): first sign-in links it.
    await this.saveLink(this.dataSource.manager, user.uuid, g);
    if (!user.emailVerifiedAt) {
      await users.update(user.uuid, {
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
        emailVerificationExpires: null,
      });
    }
    await this.securityLog.logOAuthLink(user.uuid, 'google', req);
    this.logger.info(
      `Linked Google account to ${user.email} on first sign-in`,
      GoogleAuthService.name,
    );
    return { kind: 'user', user };
  }

  private assertGoogleAllowed(user: User): void {
    if (user.globalRole === GlobalRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Super admin accounts sign in with email and password only.',
      );
    }
  }

  private async assertNoAccount(g: GoogleIdentity): Promise<void> {
    const linked = await this.links().exists({
      where: { provider: ProviderEnum.GOOGLE, providerId: g.sub },
    });
    const byEmail = await this.dataSource
      .getRepository(User)
      .createQueryBuilder('u')
      .where('LOWER(u.email) = :email', { email: g.email })
      .getExists();
    if (linked || byEmail) {
      throw new ConflictException(
        'An account with this Google email already exists. Sign in instead.',
      );
    }
  }

  /** A password-less user linked to this Google account (email verified by Google). */
  private async createGoogleUser(g: GoogleIdentity): Promise<User> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(User);
      const user = await repo.save(
        repo.create({
          email: g.email,
          name: g.name,
          avatarUrl: g.picture ?? undefined,
          provider: ProviderEnum.GOOGLE,
          globalRole: null,
          status: AccountStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        }),
      );
      await this.saveLink(manager, user.uuid, g);
      return user;
    });
  }

  private async saveLink(
    manager: EntityManager,
    userId: string,
    g: GoogleIdentity,
  ): Promise<void> {
    const repo = manager.getRepository(OAuthProvider);
    await repo.save(
      repo.create({
        userId,
        provider: ProviderEnum.GOOGLE,
        providerId: g.sub,
        email: g.email,
        displayName: g.name,
        avatarUrl: g.picture ?? undefined,
        profileData: { hd: g.hd },
      }),
    );
  }
}
