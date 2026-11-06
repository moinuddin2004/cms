import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
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
