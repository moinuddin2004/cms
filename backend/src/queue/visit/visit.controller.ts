import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Can } from 'src/access/decorators/access.decorators';
import { RateLimit } from 'src/auth/guards/rate-limiter.guard';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { Public } from 'src/common/decorators/publicDecorator';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import type { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { VisitService } from './visit.service';

/** Public visit page data (07 §6.3): rate limited, no names, one generic 404. */
@Controller('visit')
export class VisitController {
  constructor(private readonly visits: VisitService) {}

  @Get(':token/state')
  @Public()
  @RateLimit({ maxAttempts: 120, windowSeconds: 60 })
  async state(@Param('token') token: string) {
    return ResponseWrapper.success(await this.visits.state(token));
  }
}

/** Reception: share a visit link for an entry. */
@Controller('queue/entries')
export class VisitLinkController {
  constructor(private readonly visits: VisitService) {}

  @Post(':entryId/visit-link')
  @HttpCode(HttpStatus.CREATED)
  @Can('queue.checkin')
  @RateLimit({ maxAttempts: 60, windowSeconds: 600 })
  async create(
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.visits.createLink(
      ctx.organizationId,
      ctx.locationId,
      entryId,
    );
    return ResponseWrapper.success(data, 'Visit link created');
  }
}
