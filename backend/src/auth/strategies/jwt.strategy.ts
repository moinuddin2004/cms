import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { assertStaffAudience } from '../staff-audience';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET')!,
    });
  }

  async validate(payload: any) {
    // TODO(M4-06): require aud — a no-aud token is accepted only until the
    // transition window closes.
    assertStaffAudience(payload as { aud?: unknown });
    return {
      uuid: payload.sub,
      email: payload.email,
      globalRole: payload.globalRole || null,
      sessionId: payload.sessionId,
      authMethod: payload.amr || 'password',
      authDomain: payload.hd || null,
    };
  }
}
