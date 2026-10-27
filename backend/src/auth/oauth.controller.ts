import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { Public } from 'src/common/decorators/publicDecorator';
import { REMEMBERED_SESSION_MS } from '../session/session-lifetime';

/**
 * Google / GitHub sign-in — DISABLED.
 *
 * Kept for later but not registered: neither this controller nor
 * `GoogleStrategy` / `GithubStrategy` are listed in `AuthModule`, so the
 * `/auth/google*` and `/auth/github*` routes don't exist. To turn it back on,
 * register all three in `AuthModule`, read the callback/frontend URLs from
 * env (`FRONTEND_URL`, `API_URL`) instead of localhost, and add the routes to
 * `PUBLIC_ROUTES`.
 */
@Controller('auth')
export class OAuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    return ResponseWrapper.success(null, 'Redirecting to Google...');
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: any, @Res() res: Response) {
    return this.finishOAuth(req, res);
  }

  @Public()
  @Get('github')
  @UseGuards(AuthGuard('github'))
  async githubAuth() {
    return ResponseWrapper.success(null, 'Redirecting to GitHub...');
  }

  @Public()
  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  async githubCallback(@Req() req: any, @Res() res: Response) {
    return this.finishOAuth(req, res);
  }

  private async finishOAuth(req: any, res: Response) {
    const { refreshToken, sessionId } = await this.authService.handleOAuthLogin(
      req.user,
      req,
    );

    const cookieValue = `${sessionId}:${refreshToken}`;
    res.cookie('refresh_token', cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: REMEMBERED_SESSION_MS,
    });

    const redirect = (req.query.redirect as string) || '/dashboard';
    const redirectUrl =
      redirect.startsWith('/') && !redirect.startsWith('//')
        ? redirect
        : '/dashboard';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(
      `${frontendUrl}/?oauth=true&redirect=${encodeURIComponent(redirectUrl)}`,
    );
  }
}
