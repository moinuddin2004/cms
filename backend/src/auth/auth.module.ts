import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtTokenService } from './jwt.service';
import { UserService } from 'src/user/user.service';
import { ConfigService } from '@nestjs/config';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { UserModule } from 'src/user/user.module';
import { GithubStrategy } from './strategies/github.strategy';
import { GoogleStrategy } from './strategies/google.stategy';
import { CommonModule } from 'src/common/common.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SecurityLogService } from './security-log.service';
import { SecurityLog } from './entities/SecurityLog';
import { OAuthProvider } from './entities/OAuthProvider';
import { RateLimiterGuard } from './guards/rate-limiter.guard';
import { APP_GUARD } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import { SessionModule } from 'src/session/session.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SecurityLog, OAuthProvider]),
    UserModule,
    CommonModule,
    SessionModule,
  ],
  providers: [
    AuthService,
    JwtTokenService,
    UserService,
    NestJwtService,
    ConfigService,
    GoogleStrategy,
    GithubStrategy,
    JwtStrategy,
    SecurityLogService,
    RateLimiterGuard,
    Reflector,
  ],
  exports: [JwtStrategy, SecurityLogService],
  controllers: [AuthController],
})
export class AuthModule { }

