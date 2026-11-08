import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { Public } from 'src/common/decorators/publicDecorator';
import { ContextFree } from 'src/common/decorators/context-free.decorator';
import { RateLimit } from '../guards/rate-limiter.guard';
import { JwtAuthGuard } from '../guards/jwt.guard';
import { GoogleAuthService } from './google-auth.service';
import { GoogleIdentityService } from './google-identity.service';
import {
  DesktopExchangeDto,
  DesktopHandoffDto,
  GoogleCredentialDto,
  GoogleJoinRequestDto,
  GoogleRegisterDto,
  GoogleSignInDto,
} from './google-auth.dto';

type AuthedRequest = Request & { user: { uuid: string } };

/**
 * "Continue with Google" (Google Identity Services ID token → our session)
 * and the signed-in user's sign-in methods. Public routes carry @Public().
 */
@Controller('auth')
export class GoogleAuthController {
  constructor(
    private readonly google: GoogleAuthService,
    private readonly identity: GoogleIdentityService,
  ) {}

  /** The public OAuth client id the web app renders the Google button with. */
  @Public()
  @Get('google/config')
  config() {
    const clientId = this.identity.clientId;
    return ResponseWrapper.success(
      { enabled: !!clientId, clientId },
      'Google sign-in config',
    );
  }

  @Public()
  @Post('google')
  @RateLimit({ maxAttempts: 10, windowSeconds: 900 })
  async signIn(
    @Body() dto: GoogleSignInDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.google.signIn(dto, req, res);
    return ResponseWrapper.success(
      result,
      result.outcome === 'signed_in' ? 'Login successful' : 'Google verified',
    );
  }

  @Public()
  @Get('google/desktop/start')
  desktopStart(@Query('state') state: string, @Res() res: Response) {
    const clean = typeof state === 'string' ? state.trim() : '';
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(clean)) {
      res.status(400).send('Invalid sign-in state. Start again from the app.');
      return;
    }
    // The browser page that runs Google Identity Services lives on the web
    // app's origin (the one registered with Google), never on the API origin.
    res.redirect(302, `${webAppUrl()}/desktop-google?state=${clean}`);
  }

  /**
   * Browser half of the desktop flow: the web page posts the Google ID token
   * here and gets a one-time code back, which it forwards to the app over
   * `clinic://auth/callback`. No session is created in the browser.
   */
  @Public()
  @Post('google/desktop/handoff')
  @RateLimit({ maxAttempts: 10, windowSeconds: 900 })
  async desktopHandoff(@Body() dto: DesktopHandoffDto, @Req() req: Request) {
    const result = await this.google.createDesktopHandoff(
      dto.credential,
      dto.state,
      req,
    );
    return ResponseWrapper.success(
      result,
      result.outcome === 'signed_in'
        ? 'Ready for the desktop app'
        : 'Google verified',
    );
  }

  /**
   * App half: redeem the one-time code. Sent by the Tauri webview, so the
   * session (including the refresh token in the body) is the desktop one.
   */
  @Public()
  @Post('google/desktop/exchange')
  @RateLimit({ maxAttempts: 20, windowSeconds: 900 })
  async desktopExchange(
    @Body() dto: DesktopExchangeDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.google.exchangeDesktopHandoff(
      dto.code,
      req,
      res,
    );
    return ResponseWrapper.success(session, 'Login successful');
  }

  @Public()
  @Post('google/register')
  @RateLimit({ maxAttempts: 5, windowSeconds: 3600 })
  async register(
    @Body() dto: GoogleRegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.google.register(dto, req, res);
    return ResponseWrapper.success(result, 'Registration successful');
  }

  @Public()
  @Post('google/join-request')
  @RateLimit({ maxAttempts: 5, windowSeconds: 3600 })
  async joinRequest(
    @Body() dto: GoogleJoinRequestDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.google.requestToJoin(dto, req, res);
    return ResponseWrapper.success(result, 'Join request sent');
  }

  @ContextFree()
  @Get('login-methods')
  @UseGuards(JwtAuthGuard)
  async loginMethods(@Req() req: AuthedRequest) {
    return ResponseWrapper.success(
      await this.google.loginMethods(req.user.uuid),
      'Sign-in methods retrieved',
    );
  }

  @ContextFree()
  @Post('google/link')
  @UseGuards(JwtAuthGuard)
  @RateLimit({ maxAttempts: 10, windowSeconds: 900 })
  async link(@Body() dto: GoogleCredentialDto, @Req() req: AuthedRequest) {
    return ResponseWrapper.success(
      await this.google.link(req.user.uuid, dto.credential, req),
      'Google account linked',
    );
  }

  @ContextFree()
  @Delete('google/link')
  @UseGuards(JwtAuthGuard)
  async unlink(@Req() req: AuthedRequest) {
    return ResponseWrapper.success(
      await this.google.unlink(req.user.uuid, req),
      'Google account unlinked',
    );
  }
}

/** The web app's public base URL (the origin registered with Google). */
function webAppUrl(): string {
  return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(
    /\/$/,
    '',
  );
}
