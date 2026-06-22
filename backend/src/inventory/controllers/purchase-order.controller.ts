import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PurchaseOrderService } from '../services/purchase-order.service';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderStatusDto,
  BulkReceiveDto,
  PurchaseOrderFilterDto,
} from '../dto/purchase-order.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { RequireFeature } from 'src/common/decorators/require-feature.decorator';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';

@Controller('purchase-orders')
@RequireFeature('inventory.core')
export class PurchaseOrderController {
  constructor(private readonly poService: PurchaseOrderService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreatePurchaseOrderDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.poService.create(
      ctx.organizationId,
      ctx.locationId,
      dto,
      req.user?.uuid,
    );
    return ResponseWrapper.success(data, 'Purchase order created successfully');
  }

  @Get()
  async findAll(
    @Query() query: PurchaseOrderFilterDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.poService.findAll(
      ctx.organizationId,
      ctx.locationId,
      query,
    );
    return ResponseWrapper.success(data);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.poService.findOne(id, ctx.organizationId);
    return ResponseWrapper.success(data);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePurchaseOrderStatusDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.poService.updateStatus(
      id,
      ctx.organizationId,
      dto.status,
    );
    return ResponseWrapper.success(data, 'Purchase order status updated');
  }

  @Post(':id/receive')
  async receiveItems(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BulkReceiveDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.poService.receiveItems(
      id,
      ctx.organizationId,
      ctx.locationId,
      dto,
      req.user?.uuid,
    );
    return ResponseWrapper.success(data, 'Items received and stock updated');
  }

  @Delete(':id')
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.poService.cancel(id, ctx.organizationId);
    return ResponseWrapper.success(data, 'Purchase order cancelled');
  }
}
