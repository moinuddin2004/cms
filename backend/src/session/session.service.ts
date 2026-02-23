import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSession } from './entities/user-session.entity';
import { Request } from 'express';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as useragent from 'useragent';

@Injectable()
export class SessionService {
    private readonly logger = new Logger(SessionService.name);

    constructor(
        @InjectRepository(UserSession)
        private readonly sessionRepository: Repository<UserSession>,
    ) { }

    /**
     * Creates a new user session and generates a refresh token
     */
    async createSession(
        userId: string,
        req: Request,
    ): Promise<{ session: UserSession; refreshToken: string }> {
        // Generate a secure random refresh token
        const refreshToken = crypto.randomBytes(64).toString('hex');
        const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

        // Parse user agent
        const userAgentString = req.headers['user-agent'] || '';
        const agent = useragent.parse(userAgentString);

        // Extract IP address
        const ipAddress =
            (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
            req.socket.remoteAddress ||
            '';

        // Set expiration (e.g., 7 days from now)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

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
        });

        await this.sessionRepository.save(session);
        this.logger.log(`Created new session for user ${userId}`);

        return { session, refreshToken };
    }

    /**
     * Retrieves a session by its ID
     */
    async getSessionById(sessionId: string): Promise<UserSession | null> {
        return this.sessionRepository.findOne({ where: { uuid: sessionId, isRevoked: false } });
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
        await this.sessionRepository.update({ uuid: sessionId }, { isRevoked: true });
        this.logger.log(`Revoked session ${sessionId}`);
    }

    /**
     * Revokes all active sessions for a user (optionally keeping one excepted session)
     */
    async revokeAllSessions(userId: string, exceptSessionId?: string): Promise<number> {
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
    async validateSession(sessionId: string, refreshToken: string): Promise<UserSession | null> {
        const session = await this.sessionRepository.findOne({ where: { uuid: sessionId } });

        if (!session || session.isRevoked || session.expiresAt < new Date()) {
            return null;
        }

        const isTokenValid = await bcrypt.compare(refreshToken, session.refreshTokenHash);

        if (isTokenValid) {
            // Update last active touch
            await this.sessionRepository.update({ uuid: sessionId }, { lastActiveAt: new Date() });
            return session;
        }

        return null;
    }

    /**
     * Rotates a refresh token for an existing session
     */
    async rotateRefreshToken(sessionId: string): Promise<{ session: UserSession; refreshToken: string } | null> {
        const session = await this.sessionRepository.findOne({ where: { uuid: sessionId } });

        if (!session || session.isRevoked || session.expiresAt < new Date()) {
            return null; // Session invalid
        }

        // Generate new token
        const newRefreshToken = crypto.randomBytes(64).toString('hex');
        const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 10);

        // Update expiration (extend session slightly)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        // Save updates
        session.refreshTokenHash = newRefreshTokenHash;
        session.expiresAt = expiresAt;
        session.lastActiveAt = new Date();

        await this.sessionRepository.save(session);

        return { session, refreshToken: newRefreshToken };
    }
}
