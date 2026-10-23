import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { RegisterRequestDto } from './dto/request/register-request.dto';
import { LoginRequestDto } from './dto/request/login-request.dto';
import { UserService } from 'src/user/user.service';
import { AuthTokenDto } from './dto/response/auth.token.dto';
import { JwtTokenService } from './jwt.service';
import { MailService } from 'src/common/services/mail.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { ValidationFailedException } from 'src/common/exceptions/ValidationFailedException';
import { Transactional } from 'src/common/decorators/TransactionalDecorator';
import { AppLogger } from 'src/common/services/logger.service';
import { ProviderEnum } from './enum/ProviderEnum';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { Response, Request } from 'express';
import { SecurityLogService } from './security-log.service';
import { AccountStatus } from '../user/enum/AccountStatus';
import { SessionService } from '../session/session.service';
import {
  AuthorizationService,
  AccessibleOrganization,
  legacyLocationFlags,
  UserPermissions,
} from './services/authorization.service';
import { AccessResolver } from 'src/access/access.resolver';
import { ClinicSetupService } from 'src/subscriptions/clinic-setup.service';
import {
  findLabMemberships,
  LabMembership,
} from 'src/labs/portal/lab-memberships';

const BCRYPT_SALT_ROUNDS = 12;
const PASSWORD_RESET_EXPIRY_MINUTES = 15;
const EMAIL_VERIFICATION_EXPIRY_HOURS = 48;

/**
 * Cookie options for refresh token.
 */
const REFRESH_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * Login response with location selection context.
 */
export interface LoginResponse {
  user: any;
  accessToken: string;
  isSuperAdmin: boolean;
  accessSource: 'super_admin' | 'owner' | 'employee' | null;
  requiresOrgSelection: boolean;
  requiresLocationSelection: boolean;
  accessibleOrganizations: AccessibleOrganization[];
  activeOrganizationId: string | null;
  activeLocationId: string | null;
  /**
   * Labs the user works in (active membership of an active lab). A user
   * with labs and no clinic organization belongs in the lab portal.
   */
  labMemberships: LabMembership[];
}

/**
 * Production-grade AuthService with session management, security logging,
 * crypto-based password reset, account status validation, and location selection.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtTokenService: JwtTokenService,
    private readonly mailService: MailService,
    private readonly logger: AppLogger,
    private readonly dataSource: DataSource,
    private readonly securityLogService: SecurityLogService,
    private readonly sessionService: SessionService,
    private readonly authorizationService: AuthorizationService,
    private readonly accessResolver: AccessResolver,
    private readonly clinicSetup: ClinicSetupService,
  ) {}

  /**
   * Self-serve signup: creates the owner's login and their clinic (main
   * location, 14-day trial — see ClinicSetupService), emails a verification
   * link, then signs them in like `login()`.
   */
  async register(
    dto: RegisterRequestDto,
    req: Request,
    res: Response,
  ): Promise<LoginResponse> {
    this.logger.info(
      `Registering user with email: ${dto.email}`,
      AuthService.name,
    );

    const user = await this.userService.createLocalUser(dto);
    try {
      await this.clinicSetup.createClinicForOwner(user, {
        clinicName: dto.clinicName,
        phone: dto.phone,
      });
    } catch (err) {
      // No clinic means no usable account — don't leave a dangling login.
      await this.userRepository.delete(user.uuid);
      throw err;
    }
    await this.sendVerificationEmail(user);

    this.logger.info(
      `Registration complete for: ${user.email}`,
      AuthService.name,
    );
    return this.login({ email: dto.email, password: dto.password }, req, res);
  }

  /** New verification token for a self-signup; failures to send are logged only. */
  private async sendVerificationEmail(user: User): Promise<void> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    await this.userRepository.update(user.uuid, {
      emailVerificationToken: crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex'),
      emailVerificationExpires: new Date(
        Date.now() + EMAIL_VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000,
      ),
    });
    try {
      await this.mailService.sendEmailVerification(user.email, rawToken);
    } catch (err) {
      this.logger.error(
        `Verification email to ${user.email} failed: ${(err as Error).message}`,
        AuthService.name,
      );
    }
  }

  /** Confirm an email address from the link in the verification email. */
  async verifyEmail(token: string): Promise<{ message: string }> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.emailVerificationToken = :tokenHash', { tokenHash })
      .andWhere('user.emailVerificationExpires > :now', { now: new Date() })
      .getOne();
    if (!user) {
      throw new ValidationFailedException(
        'This verification link is invalid or has expired',
      );
    }
    await this.userRepository.update(user.uuid, {
      emailVerificationToken: null,
      emailVerificationExpires: null,
      emailVerifiedAt: new Date(),
    });
    this.logger.info(`Email verified for: ${user.email}`, AuthService.name);
    return { message: 'Email verified' };
  }

  /** Send a fresh link to a signed-in user whose email is still unverified. */
  async resendVerification(userId: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOneBy({ uuid: userId });
    if (!user) throw new NotFoundException('User not found');
    if (!user.emailVerificationToken) {
      return { message: 'Email already verified' };
    }
    await this.sendVerificationEmail(user);
    return { message: 'Verification email sent' };
  }

  /**
   * Login with email and password.
   * Creates a new session, resolves accessible locations, and
   * returns whether location selection is required.
   */
  async login(
    dto: LoginRequestDto,
    req: Request,
    res: Response,
  ): Promise<LoginResponse> {
    this.logger.info(`Login attempt for: ${dto.email}`, AuthService.name);

    // Validate user credentials
    const user = await this.userService.validateUser(dto.email, dto.password);

    // Check account status
    this.validateAccountStatus(user, req);

    // Create a new session (enforces max 5 sessions)
    const { session, refreshToken } = await this.sessionService.createSession(
      user.uuid,
      req,
    );

    // Resolve user's accessible organizations and locations
    const accessInfo = await this.authorizationService.resolveUserAccess(
      user.uuid,
    );

    // Smart selector logic
    const orgCount = accessInfo.accessibleOrganizations.length;
    const totalLocations = accessInfo.accessibleOrganizations.reduce(
      (count, org) => count + org.locations.length,
      0,
    );

    // Determine what selection the user needs
    let requiresOrgSelection = false;
    let requiresLocationSelection = false;
    let activeOrgId: string | null = null;
    let activeLocId: string | null = null;

    if (accessInfo.isSuperAdmin) {
      // Super admin always picks org first, then location
      requiresOrgSelection = orgCount > 0;
      requiresLocationSelection = false; // will pick after org
    } else if (orgCount === 0) {
      // No access at all
    } else if (orgCount === 1) {
      const org = accessInfo.accessibleOrganizations[0];
      activeOrgId = org.id;
      if (org.locations.length === 1) {
        // Single org, single location → auto-select
        activeLocId = org.locations[0].id;
        await this.userService.updateLastAccessed(
          user.uuid,
          activeOrgId,
          activeLocId,
        );
      } else if (org.locations.length > 1) {
        // Single org, multiple locations → show location selector
        requiresLocationSelection = true;
      }
    } else {
      // Multiple orgs → show org selector first
      requiresOrgSelection = true;
    }

    // Use last accessed as fallback if no auto-selection happened
    if (!activeOrgId && accessInfo.defaultOrganizationId) {
      activeOrgId = accessInfo.defaultOrganizationId;
    }
    if (!activeLocId && accessInfo.defaultLocationId) {
      activeLocId = accessInfo.defaultLocationId;
    }

    // Generate access token with globalRole
    const accessToken = await this.generateAccessToken(user, session.uuid);

    // Store session ID and refresh token in httpOnly cookie
    this.setSessionCookie(res, session.uuid, refreshToken);

    // Log successful login
    await this.securityLogService.logLoginSuccess(user.uuid, session.uuid, req);

    this.logger.info(`Login successful for: ${dto.email}`, AuthService.name);

    return {
      user: AuthTokenDto.toDto(accessToken, user).user,
      accessToken,
      isSuperAdmin: accessInfo.isSuperAdmin,
      accessSource: accessInfo.accessSource,
      requiresOrgSelection,
      requiresLocationSelection,
      accessibleOrganizations: accessInfo.accessibleOrganizations,
      activeOrganizationId: activeOrgId,
      activeLocationId: activeLocId,
      labMemberships: await findLabMemberships(
        this.dataSource.manager,
        user.uuid,
      ),
    };
  }

  /**
   * Select a location after login.
   * Called when a user has multiple accessible locations.
   */
  async selectLocation(
    userId: string,
    organizationId: string,
    locationId: string,
  ): Promise<{ activeOrganizationId: string; activeLocationId: string }> {
    // Validate access
    const hasAccess = await this.authorizationService.validateAccess(
      userId,
      organizationId,
      locationId,
    );

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this location');
    }

    // Save last accessed context
    await this.userService.updateLastAccessed(
      userId,
      organizationId,
      locationId,
    );

    return {
      activeOrganizationId: organizationId,
      activeLocationId: locationId,
    };
  }

  /**
   * Switch to a different location during an active session.
   * Re-validates access and updates last accessed context.
   */
  async switchLocation(
    userId: string,
    organizationId: string,
    locationId: string,
  ): Promise<{
    activeOrganizationId: string;
    activeLocationId: string;
    /** @deprecated See `legacyLocationFlags`. */
    permissions: UserPermissions;
  }> {
    // Validate access
    const hasAccess = await this.authorizationService.validateAccess(
      userId,
      organizationId,
      locationId,
    );

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this location');
    }

    // Deprecated legacy flags (the web app reads /me/access), derived
    // from the new permissions at the new location.
    const permissions = legacyLocationFlags(
      await this.accessResolver.resolve(userId, organizationId, locationId),
    );

    // Save last accessed context
    await this.userService.updateLastAccessed(
      userId,
      organizationId,
      locationId,
    );

    return {
      activeOrganizationId: organizationId,
      activeLocationId: locationId,
      permissions,
    };
  }

  /**
   * Logout from current session.
   */
  async logout(req: Request, res: Response): Promise<{ message: string }> {
    this.logger.info(`Logout attempt`, AuthService.name);

    const sessionId = this.getSessionIdFromCookie(req);

    if (sessionId) {
      const session = await this.sessionService.getSessionById(sessionId);
      if (session) {
        await this.sessionService.revokeSession(sessionId);
        await this.securityLogService.logLogout(session.userId, sessionId, req);
      }
    }

    // Clear session cookie
    this.clearSessionCookie(res);

    this.logger.info(`Logout successful`, AuthService.name);

    return { message: 'Logged out successfully' };
  }

  /**
   * Logout from all devices/sessions.
   */
  async logoutAll(
    userId: string,
    req: Request,
    res: Response,
  ): Promise<{ message: string; sessionsRevoked: number }> {
    this.logger.info(
      `Logout all attempt for user: ${userId}`,
      AuthService.name,
    );

    const count = await this.sessionService.revokeAllSessions(userId);

    await this.securityLogService.logLogoutAll(userId, count, req);

    // Clear current session cookie
    this.clearSessionCookie(res);

    this.logger.info(
      `Logout all successful: ${count} sessions revoked`,
      AuthService.name,
    );

    return { message: 'Logged out from all devices', sessionsRevoked: count };
  }

  /**
   * Refresh access token using session-specific refresh token.
   * Implements token rotation for enhanced security.
   */
  async refreshTokens(req: Request, res: Response): Promise<LoginResponse> {
    const { sessionId, refreshToken } = this.getSessionDataFromCookie(req);

    if (!sessionId || !refreshToken) {
      this.clearSessionCookie(res);
      throw new ForbiddenException('No valid session found');
    }

    // Validate session and refresh token
    const session = await this.sessionService.validateSession(
      sessionId,
      refreshToken,
    );

    if (!session) {
      this.clearSessionCookie(res);
      throw new ForbiddenException('Invalid or expired session');
    }

    // Get user
    const user = await this.userRepository.findOneBy({ uuid: session.userId });
    if (!user) {
      this.clearSessionCookie(res);
      throw new ForbiddenException('User not found');
    }

    // Check account status
    try {
      this.validateAccountStatus(user, req);
    } catch (error) {
      this.clearSessionCookie(res);
      await this.sessionService.revokeSession(sessionId);
      throw error;
    }

    // Rotate refresh token
    const rotated = await this.sessionService.rotateRefreshToken(sessionId);
    if (!rotated) {
      this.clearSessionCookie(res);
      throw new ForbiddenException('Failed to refresh session');
    }

    // Generate new access token
    const accessToken = await this.generateAccessToken(user, sessionId);

    // Update cookie with new refresh token
    this.setSessionCookie(res, sessionId, rotated.refreshToken);

    // Resolve access info for the refreshed user
    const accessInfo = await this.authorizationService.resolveUserAccess(
      user.uuid,
    );
    const orgCount = accessInfo.accessibleOrganizations.length;
    const totalLocations = accessInfo.accessibleOrganizations.reduce(
      (count, org) => count + org.locations.length,
      0,
    );

    const hasActiveContext = !!(
      user.lastAccessedOrganizationId && user.lastAccessedLocationId
    );

    return {
      user: AuthTokenDto.toDto(accessToken, user).user,
      accessToken,
      isSuperAdmin: accessInfo.isSuperAdmin,
      accessSource: accessInfo.accessSource,
      requiresOrgSelection:
        !hasActiveContext &&
        (accessInfo.isSuperAdmin ? orgCount > 0 : orgCount > 1),
      requiresLocationSelection:
        !hasActiveContext &&
        !accessInfo.isSuperAdmin &&
        orgCount === 1 &&
        totalLocations > 1,
      accessibleOrganizations: accessInfo.accessibleOrganizations,
      activeOrganizationId:
        user.lastAccessedOrganizationId || accessInfo.defaultOrganizationId,
      activeLocationId:
        user.lastAccessedLocationId || accessInfo.defaultLocationId,
      labMemberships: await findLabMemberships(
        this.dataSource.manager,
        user.uuid,
      ),
    };
  }

  /**
   * Handle OAuth login/signup.
   */
  async handleOAuthLogin(
    profile: {
      email: string;
      name: string;
      provider: ProviderEnum;
      providerId?: string;
    },
    req: Request,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    sessionId: string;
    isNewUser: boolean;
  }> {
    this.logger.info(
      `OAuth login from ${profile.provider} for ${profile.email}`,
      AuthService.name,
    );

    let isNewUser = false;
    let user = await this.userRepository.findOneBy({ email: profile.email });

    if (!user) {
      user = await this.userService.createOAuthUser(profile);
      isNewUser = true;
      this.logger.info(`OAuth user created: ${user.email}`, AuthService.name);
    }

    // Check account status
    this.validateAccountStatus(user, req);

    // Create session
    const { session, refreshToken } = await this.sessionService.createSession(
      user.uuid,
      req,
    );

    // Generate access token
    const accessToken = await this.generateAccessToken(user, session.uuid);

    // Log OAuth login
    await this.securityLogService.logOAuthLogin(
      user.uuid,
      session.uuid,
      profile.provider,
      req,
      isNewUser,
    );

    return { accessToken, refreshToken, sessionId: session.uuid, isNewUser };
  }

  /**
   * Initiate password reset flow.
   */
  @Transactional()
  async forgotPassword(email: string, req: Request, manager?: EntityManager) {
    this.logger.debug(
      `Initiating forgot password for: ${email}`,
      AuthService.name,
    );

    const user = await this.userRepository.findOneBy({ email });
    if (!user) {
      await this.securityLogService.logPasswordResetRequest(email, req);
      return { message: 'If the email exists, a reset link will be sent' };
    }

    const rawToken = crypto.randomUUID();
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const passwordResetExpires = new Date(
      Date.now() + PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000,
    );
    await this.userRepository.update(user.uuid, {
      passwordResetToken: tokenHash,
      passwordResetExpires,
    });

    await this.mailService.sendPasswordReset(user.email, rawToken);
    await this.securityLogService.logPasswordResetRequest(email, req);

    this.logger.info(
      `Password reset link sent to: ${user.email}`,
      AuthService.name,
    );
    return { message: 'If the email exists, a reset link will be sent' };
  }

  /**
   * Reset password using token.
   */
  async resetPassword(token: string, newPassword: string, req?: Request) {
    this.logger.debug(`Resetting password with token`, AuthService.name);

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.passwordResetToken = :tokenHash', { tokenHash })
      .andWhere('user.passwordResetExpires > :now', { now: new Date() })
      .getOne();

    if (!user) {
      this.logger.warn(
        'Reset password failed due to invalid/expired token',
        AuthService.name,
      );
      throw new ValidationFailedException('Invalid or expired token');
    }

    user.password = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await this.userRepository.update(user.uuid, {
      password: user.password,
      passwordResetToken: null,
      passwordResetExpires: null,
    });

    const revokedCount = await this.sessionService.revokeAllSessions(user.uuid);
    this.logger.info(
      `Revoked ${revokedCount} sessions after password reset for user: ${user.uuid}`,
      AuthService.name,
    );

    await this.securityLogService.logPasswordResetSuccess(user.uuid, req);

    this.logger.info(
      `Password reset successful for: ${user.email}`,
      AuthService.name,
    );
    return { message: 'Password reset successfully' };
  }

  /**
   * Change password for authenticated user.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    req: Request,
    revokeOtherSessions: boolean = true,
  ): Promise<{ message: string; sessionsRevoked?: number }> {
    const user = await this.userRepository.findOneBy({ uuid: userId });
    if (!user) throw new NotFoundException('User not found');

    if (user.password) {
      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        throw new UnauthorizedException('Current password is incorrect');
      }
    }

    if (newPassword.length < 6) {
      throw new ValidationFailedException(
        'Password must be at least 6 characters',
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    await this.userRepository.update(userId, { password: hashedPassword });

    let sessionsRevoked = 0;
    if (revokeOtherSessions) {
      const currentSessionId = this.getSessionIdFromCookie(req);
      sessionsRevoked = await this.sessionService.revokeAllSessions(
        userId,
        currentSessionId ?? undefined,
      );
    }

    await this.securityLogService.logPasswordChange(userId, req);

    return {
      message: 'Password changed successfully',
      sessionsRevoked: revokeOtherSessions ? sessionsRevoked : undefined,
    };
  }

  /**
   * Add password to OAuth-only account.
   */
  async addPassword(
    userId: string,
    newPassword: string,
    req?: Request,
  ): Promise<{ message: string }> {
    const user = await this.userRepository.findOneBy({ uuid: userId });
    if (!user) throw new NotFoundException('User not found');

    if (user.password) {
      throw new BadRequestException('Account already has a password');
    }

    if (newPassword.length < 6) {
      throw new ValidationFailedException(
        'Password must be at least 6 characters',
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    await this.userRepository.update(userId, { password: hashedPassword });

    this.logger.info(
      `Password added to OAuth account: ${user.uuid}`,
      AuthService.name,
    );

    return { message: 'Password added successfully' };
  }

  /**
   * Get current user info with accessible locations.
   */
  async getCurrentUser(userId: string) {
    const user = await this.userRepository.findOneBy({ uuid: userId });
    if (!user) throw new NotFoundException('User not found');

    const accessToken = await this.generateAccessToken(user);
    const accessInfo = await this.authorizationService.resolveUserAccess(
      user.uuid,
    );
    const orgCount = accessInfo.accessibleOrganizations.length;
    const totalLocations = accessInfo.accessibleOrganizations.reduce(
      (count, org) => count + org.locations.length,
      0,
    );

    const hasActiveContext = !!(
      user.lastAccessedOrganizationId && user.lastAccessedLocationId
    );

    return {
      user: AuthTokenDto.toDto(accessToken, user).user,
      accessToken,
      isSuperAdmin: accessInfo.isSuperAdmin,
      accessSource: accessInfo.accessSource,
      requiresOrgSelection:
        !hasActiveContext &&
        (accessInfo.isSuperAdmin ? orgCount > 0 : orgCount > 1),
      requiresLocationSelection:
        !hasActiveContext &&
        !accessInfo.isSuperAdmin &&
        orgCount === 1 &&
        totalLocations > 1,
      accessibleOrganizations: accessInfo.accessibleOrganizations,
      activeOrganizationId:
        user.lastAccessedOrganizationId || accessInfo.defaultOrganizationId,
      activeLocationId:
        user.lastAccessedLocationId || accessInfo.defaultLocationId,
      labMemberships: await findLabMemberships(
        this.dataSource.manager,
        user.uuid,
      ),
    };
  }

  /**
   * Validate account status and throw appropriate errors.
   */
  private validateAccountStatus(user: User, req: Request): void {
    switch (user.status) {
      case AccountStatus.SUSPENDED:
        this.securityLogService.logLoginFailed(
          user.email,
          req,
          'Account suspended',
        );
        throw new ForbiddenException(
          'Your account has been suspended. Please contact support.',
        );

      case AccountStatus.DELETED:
        this.securityLogService.logLoginFailed(
          user.email,
          req,
          'Account deleted',
        );
        throw new ForbiddenException('This account has been deleted.');
    }
  }

  /**
   * Generate access token for user.
   */
  private async generateAccessToken(
    user: User,
    sessionId?: string,
  ): Promise<string> {
    return this.jwtTokenService.generateAccessToken(
      user.uuid,
      user.email,
      user.globalRole,
      sessionId,
    );
  }

  /**
   * Set session cookie with session ID and refresh token.
   */
  private setSessionCookie(
    res: Response,
    sessionId: string,
    refreshToken: string,
  ): void {
    const cookieValue = `${sessionId}:${refreshToken}`;
    res.cookie('refresh_token', cookieValue, REFRESH_TOKEN_COOKIE_OPTIONS);
  }

  /**
   * Clear session cookie.
   */
  private clearSessionCookie(res: Response): void {
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
  }

  /**
   * Get session ID from cookie.
   */
  private getSessionIdFromCookie(req: Request): string | null {
    const cookie = req.cookies['refresh_token'];
    if (!cookie) return null;
    const [sessionId] = cookie.split(':');
    return sessionId || null;
  }

  /**
   * Get session data (ID and refresh token) from cookie.
   */
  private getSessionDataFromCookie(req: Request): {
    sessionId: string | null;
    refreshToken: string | null;
  } {
    const cookie = req.cookies['refresh_token'];
    if (!cookie) return { sessionId: null, refreshToken: null };

    const parts = cookie.split(':');
    if (parts.length < 2) return { sessionId: null, refreshToken: null };

    return {
      sessionId: parts[0],
      refreshToken: parts.slice(1).join(':'),
    };
  }
}
