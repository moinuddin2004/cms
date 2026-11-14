import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client, TokenPayload } from 'google-auth-library';

/** The parts of a verified Google ID token the app uses. */
export interface GoogleIdentity {
  /** Google's stable account id — what sign-in matches on. */
  sub: string;
  email: string;
  name: string;
  picture: string | null;
  /** Google Workspace domain; null for personal (Gmail) accounts. */
  hd: string | null;
}

/**
 * Verifies a Google Identity Services ID token (the `credential` the
 * "Sign in with Google" button returns): signature, issuer, expiry and that
 * it was minted for our client id. Only identity is used — no Google API
 * access is ever requested.
 */
@Injectable()
export class GoogleIdentityService {
  private client: OAuth2Client | null = null;

  constructor(private readonly config: ConfigService) {}

  get clientId(): string | null {
    return this.config.get<string>('GOOGLE_CLIENT_ID')?.trim() || null;
  }

  get patientAudiences(): string[] {
    return [
      this.config.get<string>('GOOGLE_CLIENT_ID'),
      this.config.get<string>('GOOGLE_ANDROID_CLIENT_ID'),
      this.config.get<string>('GOOGLE_IOS_CLIENT_ID'),
    ].flatMap((audience) => {
      const trimmed = audience?.trim();
      return trimmed ? [trimmed] : [];
    });
  }

  async verify(
    credential: string,
    audiences?: string[],
  ): Promise<GoogleIdentity> {
    const configuredAudience = this.clientId;
    const expectedAudiences =
      audiences ?? (configuredAudience ? [configuredAudience] : []);
    if (expectedAudiences.length === 0) {
      throw new ServiceUnavailableException(
        'Google sign-in is not configured on this server.',
      );
    }
    this.client ??= new OAuth2Client(
      configuredAudience ?? expectedAudiences[0],
    );

    let payload: TokenPayload | undefined;
    try {
      const ticket = await this.client.verifyIdToken({
        idToken: credential,
        audience:
          audiences === undefined ? expectedAudiences[0] : expectedAudiences,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException(
        'Google sign-in failed. Please try again.',
      );
    }

    if (
      !payload?.sub ||
      !payload.email ||
      !['accounts.google.com', 'https://accounts.google.com'].includes(
        payload.iss,
      )
    ) {
      throw new UnauthorizedException('Google sign-in failed.');
    }
    if (payload.email_verified !== true) {
      throw new UnauthorizedException(
        'Your Google email address is not verified.',
      );
    }
    return {
      sub: payload.sub,
      email: payload.email.toLowerCase(),
      name: payload.name || payload.email.split('@')[0],
      picture: payload.picture ?? null,
      hd: payload.hd?.toLowerCase() ?? null,
    };
  }
}
