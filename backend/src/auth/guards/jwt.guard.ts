import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from 'src/common/decorators/publicDecorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      const request = context.switchToHttp().getRequest<Request>();
      const authHeader =
        request.headers['authorization'] || request.headers['Authorization'];

      if (
        !authHeader ||
        typeof authHeader !== 'string' ||
        !authHeader.startsWith('Bearer ')
      ) {
        throw new UnauthorizedException(
          'No token provided. Please include a valid JWT token in the Authorization header.',
        );
      }

      // Check for expired token in info object
      if (
        info?.name === 'TokenExpiredError' ||
        info?.message === 'jwt expired'
      ) {
        throw new UnauthorizedException(
          'Token has expired. Please refresh your token.',
        );
      }

      // Check for expired token in error object
      if (
        err?.name === 'TokenExpiredError' ||
        err?.message?.includes('expired')
      ) {
        throw new UnauthorizedException(
          'Token has expired. Please refresh your token.',
        );
      }

      // Check for invalid token
      if (
        info?.name === 'JsonWebTokenError' ||
        err?.name === 'JsonWebTokenError'
      ) {
        throw new UnauthorizedException(
          'Invalid token. Please provide a valid JWT token.',
        );
      }

      // Check for other error messages
      if (info?.message) {
        throw new UnauthorizedException(
          `Authentication failed: ${info.message}`,
        );
      }

      if (err?.message && !err.message.includes('expired')) {
        throw new UnauthorizedException(
          `Authentication failed: ${err.message}`,
        );
      }

      throw (
        err ||
        new UnauthorizedException(
          'Authentication failed. Please provide a valid token.',
        )
      );
    }
    return user;
  }
}
