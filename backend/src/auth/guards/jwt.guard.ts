import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PUBLIC_ROUTES } from '../constants/public-routes';
import { Reflector } from '@nestjs/core';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method.toUpperCase();
    const path = request.url.split('?')[0].toLowerCase();

    const isPublic = PUBLIC_ROUTES.some((route) => {
      const routeMethod = route.method.toUpperCase();
      const routePath = route.path.toLowerCase();

      if (routeMethod !== method) return false;

      const regexPattern =
        '^' +
        routePath.replace(/\*\*/g, '[^\\s/]+').replace(/\//g, '\\/') +
        '$';

      const regex = new RegExp(regexPattern);
      return regex.test(path);
    });

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
