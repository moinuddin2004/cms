import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterRequestDto } from './dto/request/register-request.dto';
import { LoginRequestDto } from './dto/request/login-request.dto';
import { ForgotPasswordRequestDto } from './dto/request/forgot-password-request.dto';
import { ResetPasswordRequestDto } from './dto/request/reset-password-request.dto';
import { VerifyEmailRequestDto } from './dto/request/verify-email-request.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { Request, Response } from 'express';
import { Public } from 'src/common/decorators/publicDecorator';
import { ContextFree } from 'src/common/decorators/context-free.decorator';
import { RateLimiterGuard, RateLimit } from './guards/rate-limiter.guard';
import { JwtAuthGuard } from './guards/jwt.guard';
import { SessionService } from '../session/session.service';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
  MinLength,
  IsUUID,
} from 'class-validator';

/**
 * DTOs for password management endpoints
 */
class ChangePasswordDto {
  @IsNotEmpty()
  @IsString()
  currentPassword: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  newPassword: string;

  @IsOptional()
  @IsBoolean()
  revokeOtherSessions?: boolean;
}

class AddPasswordDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  newPassword: string;
}

class SelectLocationDto {
  @IsNotEmpty()
  @IsUUID()
  organizationId: string;

  @IsNotEmpty()
  @IsUUID()
  locationId: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
  ) {}

  /**
   * Register a new user with email/password.
   */
  @Public()
  @Post('register')
  @UseGuards(RateLimiterGuard)
  @RateLimit({ maxAttempts: 5, windowSeconds: 3600 })
  async register(
    @Body() body: RegisterRequestDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(body, req, res);
    return ResponseWrapper.success(result, 'Registration successful');
  }

  /**
   * Confirm an email address (token from the verification email).
   */
  @Public()
  @Post('verify-email')
  @UseGuards(RateLimiterGuard)
  @RateLimit({ maxAttempts: 10, windowSeconds: 900 })
  async verifyEmail(@Body() body: VerifyEmailRequestDto) {
    const result = await this.authService.verifyEmail(body.token);
    return ResponseWrapper.success(result, 'Email verified');
  }

  /**
   * Email a new verification link to the signed-in user.
   */
  @ContextFree()
  @Post('resend-verification')
  @UseGuards(JwtAuthGuard, RateLimiterGuard)
  @RateLimit({ maxAttempts: 3, windowSeconds: 3600 })
  async resendVerification(@Req() req: any) {
    const result = await this.authService.resendVerification(req.user.uuid);
    return ResponseWrapper.success(result, result.message);
  }

  /**
   * Login with email/password.
   * Returns user profile, access token, and location context.
   */
  @Public()
  @Post('login')
  @UseGuards(RateLimiterGuard)
  @RateLimit({ maxAttempts: 5, windowSeconds: 900 })
  async login(
    @Body() body: LoginRequestDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(body, req, res);
    return ResponseWrapper.success(result, 'Login successful');
  }

  /**
   * Select a location after login (when user has multiple accessible locations).
   */
  @ContextFree()
  @Post('select-location')
  @UseGuards(JwtAuthGuard)
  async selectLocation(@Body() body: SelectLocationDto, @Req() req: any) {
    const result = await this.authService.selectLocation(
      req.user.uuid,
      body.organizationId,
      body.locationId,
    );
    return ResponseWrapper.success(result, 'Location selected');
  }

  /**
   * Switch to a different location during an active session.
   */
  @ContextFree()
  @Post('switch-location')
  @UseGuards(JwtAuthGuard)
  async switchLocation(@Body() body: SelectLocationDto, @Req() req: any) {
    const result = await this.authService.switchLocation(
      req.user.uuid,
      body.organizationId,
      body.locationId,
    );
    return ResponseWrapper.success(result, 'Location switched');
  }

  /**
   * Refresh access token using httpOnly cookie.
   */
  @Public()
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.refreshTokens(req, res);
    return ResponseWrapper.success(result, 'Tokens refreshed');
  }

  /**
   * Get current user info with accessible locations.
   */
  @ContextFree()
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: any) {
    const result = await this.authService.getCurrentUser(req.user.uuid);
    return ResponseWrapper.success(result, 'User retrieved');
  }

  /**
   * Logout from current session.
   */
  @Public()
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.logout(req, res);
    return ResponseWrapper.success(result, 'Logged out successfully');
  }

  /**
   * Logout from all devices/sessions.
   */
  @ContextFree()
  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  async logoutAll(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.logoutAll(req.user.uuid, req, res);
    return ResponseWrapper.success(result, 'Logged out from all devices');
  }

  // ==================== SESSION MANAGEMENT ====================

  /**
   * Get all active sessions for current user.
   */
  @ContextFree()
  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  async getSessions(@Req() req: any) {
    const sessions = await this.sessionService.getUserSessions(req.user.uuid);

    const currentSessionId = req.user.sessionId;

    const sessionsDto = sessions.map((session) => ({
      id: session.uuid,
      device: session.device,
      browser: session.browser,
      os: session.os,
      ipAddress: session.ipAddress,
      location: session.location,
      isCurrent: session.uuid === currentSessionId,
      createdAt: session.createdAt,
      lastActiveAt: session.lastActiveAt,
    }));

    return ResponseWrapper.success(sessionsDto, 'Sessions retrieved');
  }

  /**
   * Revoke a specific session.
   */
  @ContextFree()
  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  async revokeSession(@Param('id') sessionId: string, @Req() req: any) {
    const session = await this.sessionService.getSessionById(sessionId);

    if (!session || session.userId !== req.user.uuid) {
      throw new NotFoundException('Session not found');
    }

    await this.sessionService.revokeSession(sessionId);
    return ResponseWrapper.success({ revoked: true }, 'Session revoked');
  }

  /**
   * Revoke all sessions except current.
   */
  @ContextFree()
  @Post('sessions/revoke-all')
  @UseGuards(JwtAuthGuard)
  async revokeAllSessions(@Req() req: any) {
    const currentSessionId = req.user.sessionId;
    const count = await this.sessionService.revokeAllSessions(
      req.user.uuid,
      currentSessionId,
    );
    return ResponseWrapper.success(
      { sessionsRevoked: count },
      'All other sessions revoked',
    );
  }

  // ==================== PASSWORD MANAGEMENT ====================

  /**
   * Change password for authenticated user.
   */
  @ContextFree()
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(@Body() body: ChangePasswordDto, @Req() req: any) {
    const result = await this.authService.changePassword(
      req.user.uuid,
      body.currentPassword,
      body.newPassword,
      req,
      body.revokeOtherSessions ?? true,
    );
    return ResponseWrapper.success(result, 'Password changed successfully');
  }

  /**
   * Add password to OAuth-only account.
   */
  @ContextFree()
  @Post('add-password')
  @UseGuards(JwtAuthGuard)
  async addPassword(@Body() body: AddPasswordDto, @Req() req: any) {
    const result = await this.authService.addPassword(
      req.user.uuid,
      body.newPassword,
      req,
    );
    return ResponseWrapper.success(result, 'Password added successfully');
  }

  /**
   * Forgot password - request reset link.
   */
  @Public()
  @Post('forgot-password')
  @UseGuards(RateLimiterGuard)
  @RateLimit({ maxAttempts: 3, windowSeconds: 3600 })
  async forgotPassword(
    @Body() dto: ForgotPasswordRequestDto,
    @Req() req: Request,
  ) {
    const result = await this.authService.forgotPassword(dto.email, req);
    return ResponseWrapper.success(result, 'Reset link sent');
  }

  /**
   * Reset password with token.
   */
  @Public()
  @Patch('reset-password')
  async resetPassword(
    @Body() dto: ResetPasswordRequestDto,
    @Req() req: Request,
  ) {
    const result = await this.authService.resetPassword(
      dto.token,
      dto.newPassword,
      req,
    );
    return ResponseWrapper.success(result, 'Password reset successfully');
  }
}
