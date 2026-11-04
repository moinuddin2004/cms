import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSession } from './entities/user-session.entity';
import { Request } from 'express';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as useragent from 'useragent';
import { sessionExpiryFrom } from './session-lifetime';

const BCRYPT_SALT_ROUNDS = 12;
const MAX_SESSIONS_PER_USER = 5;

/** How a session signed in — see `UserSession.authMethod`. */
export interface SessionAuth {
  method: 'password' | 'google';
  /** Google Workspace domain (`hd`), when the method is google. */
  domain?: string | null;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    @InjectRepository(UserSession)
    private readonly sessionRepository: Repository<UserSession>,
  ) {}

  /**
   * Creates a new user session and generates a refresh token.
   * Enforces max sessions per user — auto-deletes oldest if limit exceeded.
   */
  async createSession(
    userId: string,
    req: Request,
    rememberMe = false,
    auth: SessionAuth = { method: 'password' },
  ): Promise<{ session: UserSession; refreshToken: string }> {
    // Enforce max sessions — delete oldest if at limit
    await this.enforceSessionLimit(userId);

    // Generate a secure random refresh token (64 bytes)
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const refreshTokenHash = await bcrypt.hash(
      refreshToken,
      BCRYPT_SALT_ROUNDS,
    );

    // Parse user agent
    const userAgentString = req.headers['user-agent'] || '';
    const agent = useragent.parse(userAgentString);

    // Extract IP address
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.socket.remoteAddress ||
      '';

    // Set expiration: 1 day normally, 30 days with "keep me signed in"
    const expiresAt = sessionExpiryFrom(new Date(), rememberMe);

    // Create session entity
    const session = this.sessionRepository.create({
      userId,
      refreshTokenHash,
      expiresAt,
      userAgent: userAgentString,
      browser: agent.family,
      os: agent.os.family,
      device: agent.device.family,
      ipAddress,
      isRevoked: false,
      authMethod: auth.method,
      authDomain: auth.domain ?? null,
    });

    await this.sessionRepository.save(session);
    this.logger.log(`Created new session for user ${userId}`);

    return { session, refreshToken };
  }

  /**
   * Enforces max sessions per user.
   * If the user has >= MAX_SESSIONS, deletes the oldest sessions.
   */
  private async enforceSessionLimit(userId: string): Promise<void> {
    const activeSessions = await this.sessionRepository.find({
      where: { userId, isRevoked: false },
      order: { createdAt: 'ASC' },
    });

    if (activeSessions.length >= MAX_SESSIONS_PER_USER) {
      // Delete oldest sessions to make room (keep MAX - 1 so we can add 1)
      const sessionsToRevoke = activeSessions.slice(
        0,
        activeSessions.length - MAX_SESSIONS_PER_USER + 1,
      );
      for (const session of sessionsToRevoke) {
        await this.sessionRepository.update(
          { uuid: session.uuid },
          { isRevoked: true },
        );
        this.logger.log(
          `Auto-revoked oldest session ${session.uuid} for user ${userId} (limit enforcement)`,
        );
      }
    }
  }

  /**
   * Retrieves a session by its ID
   */
  async getSessionById(sessionId: string): Promise<UserSession | null> {
    return this.sessionRepository.findOne({
      where: { uuid: sessionId, isRevoked: false },
    });
  }

  /**
   * Retrieves all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<UserSession[]> {
    return this.sessionRepository.find({
      where: { userId, isRevoked: false },
      order: { lastActiveAt: 'DESC' },
    });
  }

  /**
   * Revokes a specific session
   */
  async revokeSession(sessionId: string): Promise<void> {
    await this.sessionRepository.update(
      { uuid: sessionId },
      { isRevoked: true },
    );
    this.logger.log(`Revoked session ${sessionId}`);
  }

  /**
   * Revokes all active sessions for a user (optionally keeping one excepted session)
   */
  async revokeAllSessions(
    userId: string,
    exceptSessionId?: string,
  ): Promise<number> {
    const queryBuilder = this.sessionRepository
      .createQueryBuilder()
      .update(UserSession)
      .set({ isRevoked: true })
      .where('user_id = :userId', { userId })
      .andWhere('is_revoked = :isRevoked', { isRevoked: false });

    if (exceptSessionId) {
      queryBuilder.andWhere('uuid != :exceptSessionId', { exceptSessionId });
    }

    const result = await queryBuilder.execute();
    const count = result.affected || 0;

    this.logger.log(`Revoked ${count} sessions for user ${userId}`);
    return count;
  }

  /**
   * Validates a session and its associated refresh token
   */
  async validateSession(
    sessionId: string,
    refreshToken: string,
  ): Promise<UserSession | null> {
    const session = await this.sessionRepository.findOne({
      where: { uuid: sessionId },
    });

    if (!session || session.isRevoked || session.expiresAt < new Date()) {
      return null;
    }

    const isTokenValid = await bcrypt.compare(
      refreshToken,
      session.refreshTokenHash,
    );

    if (isTokenValid) {
      // Update last active touch
      await this.sessionRepository.update(
        { uuid: sessionId },
        { lastActiveAt: new Date() },
      );
      return session;
    }

    return null;
  }

  /**
   * Rotates a refresh token for an existing session (token rotation for security)
   */
  async rotateRefreshToken(
    sessionId: string,
  ): Promise<{ session: UserSession; refreshToken: string } | null> {
    const session = await this.sessionRepository.findOne({
      where: { uuid: sessionId },
    });

    if (!session || session.isRevoked || session.expiresAt < new Date()) {
      return null;
    }

    // Generate new token
    const newRefreshToken = crypto.randomBytes(64).toString('hex');
    const newRefreshTokenHash = await bcrypt.hash(
      newRefreshToken,
      BCRYPT_SALT_ROUNDS,
    );

    // Rotate the token without extending the session. The expiry is fixed at
    // sign-in (1 day or 30 days), so "remember me" does not slide forward on
    // every refresh.
    session.refreshTokenHash = newRefreshTokenHash;
    session.lastActiveAt = new Date();

    await this.sessionRepository.save(session);

    return { session, refreshToken: newRefreshToken };
  }
}
