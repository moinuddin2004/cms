import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { CreateCouponDto, UpdateCouponDto } from './dto/coupon.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { RequireFeature } from 'src/common/decorators/require-feature.decorator';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';

@Controller('coupons')
@RequireFeature('billing.discounts')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateCouponDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.couponsService.create(
      ctx.organizationId,
      dto,
      req.user?.uuid,
    );
    return ResponseWrapper.success(data, 'Coupon created successfully');
  }

  @Get()
  async findAll(@ActiveTenant() ctx: TenantContext) {
    const data = await this.couponsService.findAll(ctx.organizationId);
    return ResponseWrapper.success(data);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCouponDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.couponsService.update(id, ctx.organizationId, dto);
    return ResponseWrapper.success(data, 'Coupon updated successfully');
  }

  @Delete(':id')
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.couponsService.deactivate(id, ctx.organizationId);
    return ResponseWrapper.success(data, 'Coupon deactivated successfully');
  }
}
