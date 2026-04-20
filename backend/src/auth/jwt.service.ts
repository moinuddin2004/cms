import { Injectable } from '@nestjs/common';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtTokenService {
  constructor(
    private readonly jwt: NestJwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Generates an access token with user info, globalRole, and sessionId.
   * Refresh tokens are handled by the SessionService (crypto random, not JWT).
   */
  async generateAccessToken(
    userUuid: string,
    email: string,
    globalRole: string | null,
    sessionId?: string,
  ): Promise<string> {
    const payload = {
      sub: userUuid,
      email,
      globalRole: globalRole || null,
      sessionId,
    };

    return this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET'),
      expiresIn: '15m',
    });
  }
}
