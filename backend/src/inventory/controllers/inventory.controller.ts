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
import { InventoryService } from '../services/inventory.service';
import { InventoryCategoryService } from '../services/inventory-category.service';
import {
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
  InventoryItemFilterDto,
  AdjustStockDto,
} from '../dto/inventory-item.dto';
import {
  CreateInventoryCategoryDto,
  UpdateInventoryCategoryDto,
} from '../dto/inventory-category.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { Can } from 'src/access/decorators/access.decorators';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';

@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly categoryService: InventoryCategoryService,
  ) {}

  // ─── Categories ─────────────────────────────────────────
  @Post('categories')
  @HttpCode(HttpStatus.CREATED)
  @Can('inventory.stock.adjust')
  async createCategory(
    @Body() dto: CreateInventoryCategoryDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.categoryService.create(ctx.organizationId, dto);
    return ResponseWrapper.success(data, 'Category created successfully');
  }

  @Get('categories')
  @Can('inventory.view')
  async getCategories(@ActiveTenant() ctx: TenantContext) {
    const data = await this.categoryService.findAll(ctx.organizationId);
    return ResponseWrapper.success(data);
  }

  @Patch('categories/:id')
  @Can('inventory.stock.adjust')
  async updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInventoryCategoryDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.categoryService.update(id, ctx.organizationId, dto);
    return ResponseWrapper.success(data, 'Category updated successfully');
  }

  @Delete('categories/:id')
  @Can('inventory.stock.adjust')
  async deactivateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.categoryService.deactivate(id, ctx.organizationId);
    return ResponseWrapper.success(data, 'Category deactivated successfully');
  }

  // ─── Items ──────────────────────────────────────────────
  @Post('items')
  @HttpCode(HttpStatus.CREATED)
  @Can('inventory.stock.adjust')
  async createItem(
    @Body() dto: CreateInventoryItemDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.inventoryService.create(
      ctx.organizationId,
      ctx.locationId,
      dto,
      req.user?.uuid,
    );
    return ResponseWrapper.success(data, 'Inventory item created successfully');
  }

  @Get('items')
  @Can('inventory.view')
  async getItems(
    @Query() query: InventoryItemFilterDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.inventoryService.findAll(
      ctx.organizationId,
      ctx.locationId,
      query,
    );
    return ResponseWrapper.success(data);
  }

  @Get('items/stats')
  @Can('inventory.view')
  async getStats(@ActiveTenant() ctx: TenantContext) {
    const data = await this.inventoryService.getStats(
      ctx.organizationId,
      ctx.locationId,
    );
    return ResponseWrapper.success(data);
  }

  @Get('items/low-stock')
  @Can('inventory.view')
  async getLowStockItems(@ActiveTenant() ctx: TenantContext) {
    const data = await this.inventoryService.getLowStockItems(
      ctx.organizationId,
      ctx.locationId,
    );
    return ResponseWrapper.success(data);
  }

  @Get('items/expiring')
  @Can('inventory.view')
  async getExpiringItems(
    @Query('daysAhead') daysAhead: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const days = daysAhead ? parseInt(daysAhead, 10) : 30;
    const data = await this.inventoryService.getExpiringItems(
      ctx.organizationId,
      ctx.locationId,
      Number.isFinite(days) ? days : 30,
    );
    return ResponseWrapper.success(data);
  }

  @Get('items/out-of-stock')
  @Can('inventory.view')
  async getOutOfStockItems(@ActiveTenant() ctx: TenantContext) {
    const data = await this.inventoryService.getOutOfStockItems(
      ctx.organizationId,
      ctx.locationId,
    );
    return ResponseWrapper.success(data);
  }

  @Get('items/:id')
  @Can('inventory.view')
  async getItem(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.inventoryService.findOne(
      id,
      ctx.organizationId,
      ctx.locationId,
    );
    return ResponseWrapper.success(data);
  }

  @Patch('items/:id')
  @Can('inventory.stock.adjust')
  async updateItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInventoryItemDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.inventoryService.update(
      id,
      ctx.organizationId,
      ctx.locationId,
      dto,
    );
    return ResponseWrapper.success(data, 'Inventory item updated successfully');
  }

  @Delete('items/:id')
  @Can('inventory.stock.adjust')
  async deactivateItem(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.inventoryService.deactivate(
      id,
      ctx.organizationId,
      ctx.locationId,
    );
    return ResponseWrapper.success(data, 'Inventory item deactivated');
  }

  @Post('items/:id/adjust-stock')
  @Can('inventory.stock.adjust')
  async adjustStock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustStockDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.inventoryService.adjustStock(
      id,
      ctx.organizationId,
      ctx.locationId,
      dto,
      req.user?.uuid,
    );
    return ResponseWrapper.success(data, 'Stock adjusted successfully');
  }

  @Get('items/:id/movements')
  @Can('inventory.view')
  async getStockMovements(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.inventoryService.getStockMovements(
      id,
      ctx.organizationId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
    return ResponseWrapper.success(data);
  }
}
