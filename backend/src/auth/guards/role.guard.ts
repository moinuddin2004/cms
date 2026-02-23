import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PUBLIC_ROUTES } from '../constants/public-routes';
import { ROLE_BASED_ROUTES } from '../constants/role-routes';
import { Role } from 'src/user/enum/role.enum';

@Injectable()
export class RoleAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<any>();
    const user = request.user;
    const method = request.method.toUpperCase();

    // normalize path
    const path = request.url.split('?')[0].toLowerCase();

    // helper: produces regex with :params support
    const buildRegex = (routePath: string) => {
      const pattern =
        '^' +
        routePath
          .toLowerCase()
          .replace(/:[^\/]+/g, '[^/]+')
          .replace(/\*\*/g, '[^\\s/]+')
          .replace(/\//g, '\\/') +
        '$';

      return new RegExp(pattern);
    };

    // Check Public Routes
    const isPublic = PUBLIC_ROUTES.some(route => {
      if (route.method.toUpperCase() !== method) return false;

      const regex = buildRegex(route.path);
      return regex.test(path);
    });

    if (isPublic) return true;

    // Check Role-based Routes
    const route = ROLE_BASED_ROUTES.find(r => {
      if (r.method.toUpperCase() !== method) return false;

      const regex = buildRegex(r.path);
      return regex.test(path);
    });

    if (!route) {
      console.log('Debug RoleAuthGuard:');
      console.log('Request Method:', method);
      console.log('Request Path:', path);
      console.log('Is Public:', isPublic);
      console.log('Searching in ROLE_BASED_ROUTES...');
      // Optional: log if we find something close
      const closeMatch = ROLE_BASED_ROUTES.find(r => r.path.includes('literacy'));
      console.log('Close match found:', closeMatch);

      throw new ForbiddenException('Access rule not defined for this route');
    }

    const allowedRoles = route.roles;
    const userRole = user?.role as Role;

    if (!allowedRoles.includes(userRole)) {
      throw new ForbiddenException(`Access denied for role: ${userRole}`);
    }

    return true;
  }
}
