import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SupplierService } from '../services/supplier.service';
import { CreateSupplierDto, UpdateSupplierDto } from '../dto/supplier.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { Can } from 'src/access/decorators/access.decorators';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';

@Controller('suppliers')
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Can('inventory.po.manage')
  async create(
    @Body() dto: CreateSupplierDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.supplierService.create(ctx.organizationId, dto);
    return ResponseWrapper.success(data, 'Supplier created successfully');
  }

  @Get()
  @Can('inventory.view')
  async findAll(@ActiveTenant() ctx: TenantContext) {
    const data = await this.supplierService.findAll(ctx.organizationId);
    return ResponseWrapper.success(data);
  }

  @Get(':id')
  @Can('inventory.view')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.supplierService.findOne(id, ctx.organizationId);
    return ResponseWrapper.success(data);
  }

  @Patch(':id')
  @Can('inventory.po.manage')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.supplierService.update(id, ctx.organizationId, dto);
    return ResponseWrapper.success(data, 'Supplier updated successfully');
  }

  @Delete(':id')
  @Can('inventory.po.manage')
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.supplierService.deactivate(id, ctx.organizationId);
    return ResponseWrapper.success(data, 'Supplier deactivated successfully');
  }
}
