import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TenantContext } from '../middleware/tenant-context.middleware';

/**
 * Parameter decorator to extract tenant context (organizationId + locationId)
 * from the request object.
 *
 * Usage:
 *   @Get('patients')
 *   async getPatients(@ActiveTenant() ctx: TenantContext) {
 *     // ctx.organizationId, ctx.locationId
 *   }
 */
export const ActiveTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): TenantContext => {
    const request = ctx.switchToHttp().getRequest();
    return (
      request.tenantContext || {
        organizationId: request.headers['x-organization-id'],
        locationId: request.headers['x-location-id'],
      }
    );
  },
);
