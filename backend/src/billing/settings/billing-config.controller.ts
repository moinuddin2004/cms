import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { RequireFeature } from 'src/common/decorators/require-feature.decorator';
import type { AccessContext } from 'src/access/access-context';
import { Access, Can } from 'src/access/decorators/access.decorators';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { BILLING_FEATURE, DISCOUNTS_FEATURE } from '../billing.constants';
import { CatalogServicesService } from '../catalog/catalog.service';
import { billingContext } from '../common/billing-context';
import {
  CreatePaymentAccountDto,
  CreateServiceDto,
  CreateServicePriceDto,
  ListActiveQueryDto,
  ListServicePricesQueryDto,
  ListServicesQueryDto,
  ResolvedPriceQueryDto,
  UpdateBillingSettingsDto,
  UpdatePaymentAccountDto,
  UpdateServiceDto,
  UpdateServicePriceDto,
} from '../dto/config.dto';
import {
  CreateDiscountTypeDto,
  ListDiscountTypesQueryDto,
  UpdateDiscountTypeDto,
} from '../dto/discount.dto';
import { DiscountTypesService } from '../discounts/discount-types.service';
import { PaymentAccountsService } from '../payment-accounts/payment-accounts.service';
import { BillingSettingsService } from './billing-settings.service';

/**
 * Billing configuration (7.1). Reads: the billing desk; writes:
 * `admin.settings.manage` (core, so the billing feature is still checked).
 */
@Controller('billing')
@RequireFeature(BILLING_FEATURE)
export class BillingConfigController {
  constructor(
    private readonly catalog: CatalogServicesService,
    private readonly settings: BillingSettingsService,
    private readonly accounts: PaymentAccountsService,
    private readonly discountTypes: DiscountTypesService,
  ) {}

  // ─── Services and prices ──────────────────────────────────────────

  @Get('services')
  @Can('billing.desk.use')
  async listServices(
    @ActiveTenant() t: TenantContext,
    @Query() q: ListServicesQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.catalog.list(t, q),
      'Services fetched',
    );
  }

  @Post('services')
  @Can('admin.settings.manage')
  async createService(
    @ActiveTenant() t: TenantContext,
    @Access() a: AccessContext,
    @Body() dto: CreateServiceDto,
  ) {
    return ResponseWrapper.success(
      await this.catalog.create(billingContext(t, a), dto),
      'Service created',
    );
  }

  @Patch('services/:serviceId')
  @Can('admin.settings.manage')
  async updateService(
    @ActiveTenant() t: TenantContext,
    @Access() a: AccessContext,
    @Param('serviceId', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return ResponseWrapper.success(
      await this.catalog.update(billingContext(t, a), id, dto),
      'Service updated',
    );
  }

  @Get('services/:serviceId/resolved-price')
  @Can('billing.desk.use')
  async resolvedPrice(
    @ActiveTenant() t: TenantContext,
    @Param('serviceId', ParseUUIDPipe) id: string,
    @Query() q: ResolvedPriceQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.catalog.resolvedPrice(t, id, q.doctorId),
      'Price resolved',
    );
  }

  @Get('service-prices')
  @Can('admin.settings.manage')
  async listPrices(
    @ActiveTenant() t: TenantContext,
    @Query() q: ListServicePricesQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.catalog.listPrices(t, q.serviceId),
      'Price overrides fetched',
    );
  }

  @Post('service-prices')
  @Can('admin.settings.manage')
  async createPrice(
    @ActiveTenant() t: TenantContext,
    @Access() a: AccessContext,
    @Body() dto: CreateServicePriceDto,
  ) {
    return ResponseWrapper.success(
      await this.catalog.createPrice(billingContext(t, a), dto),
      'Price override created',
    );
  }

  @Patch('service-prices/:id')
  @Can('admin.settings.manage')
  async updatePrice(
    @ActiveTenant() t: TenantContext,
    @Access() a: AccessContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServicePriceDto,
  ) {
    return ResponseWrapper.success(
      await this.catalog.updatePrice(billingContext(t, a), id, dto),
      'Price updated',
    );
  }

  @Delete('service-prices/:id')
  @Can('admin.settings.manage')
  async deletePrice(
    @ActiveTenant() t: TenantContext,
    @Access() a: AccessContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.catalog.deletePrice(billingContext(t, a), id);
    return ResponseWrapper.success(null, 'Price override removed');
  }

  // ─── Settings ─────────────────────────────────────────────────────

  @Get('settings')
  @Can('billing.desk.use')
  async getSettings(@ActiveTenant() t: TenantContext) {
    return ResponseWrapper.success(
      await this.settings.get(t),
      'Billing settings fetched',
    );
  }

  @Patch('settings')
  @Can('admin.settings.manage')
  async updateSettings(
    @ActiveTenant() t: TenantContext,
    @Access() a: AccessContext,
    @Body() dto: UpdateBillingSettingsDto,
  ) {
    return ResponseWrapper.success(
      await this.settings.update(billingContext(t, a), dto),
      'Billing settings saved',
    );
  }

  // ─── Payment accounts ─────────────────────────────────────────────

  @Get('payment-accounts')
  @Can('billing.desk.use')
  async listAccounts(
    @ActiveTenant() t: TenantContext,
    @Query() q: ListActiveQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.accounts.list(t, q.activeOnly),
      'Payment accounts fetched',
    );
  }

  @Post('payment-accounts')
  @Can('admin.settings.manage')
  async createAccount(
    @ActiveTenant() t: TenantContext,
    @Access() a: AccessContext,
    @Body() dto: CreatePaymentAccountDto,
  ) {
    return ResponseWrapper.success(
      await this.accounts.create(billingContext(t, a), dto),
      'Payment account created',
    );
  }

  @Patch('payment-accounts/:id')
  @Can('admin.settings.manage')
  async updateAccount(
    @ActiveTenant() t: TenantContext,
    @Access() a: AccessContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePaymentAccountDto,
  ) {
    return ResponseWrapper.success(
      await this.accounts.update(billingContext(t, a), id, dto),
      'Payment account updated',
    );
  }

  // ─── Discount types ───────────────────────────────────────────────

  @Get('discount-types')
  @Can('billing.discount.apply')
  async listDiscountTypes(
    @ActiveTenant() t: TenantContext,
    @Query() q: ListDiscountTypesQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.discountTypes.list(t, q.usableToday),
      'Discount types fetched',
    );
  }

  @Post('discount-types')
  @RequireFeature(DISCOUNTS_FEATURE)
  @Can('admin.settings.manage')
  async createDiscountType(
    @ActiveTenant() t: TenantContext,
    @Access() a: AccessContext,
    @Body() dto: CreateDiscountTypeDto,
  ) {
    return ResponseWrapper.success(
      await this.discountTypes.create(billingContext(t, a), dto),
      'Discount type created',
    );
  }

  @Patch('discount-types/:id')
  @RequireFeature(DISCOUNTS_FEATURE)
  @Can('admin.settings.manage')
  async updateDiscountType(
    @ActiveTenant() t: TenantContext,
    @Access() a: AccessContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDiscountTypeDto,
  ) {
    return ResponseWrapper.success(
      await this.discountTypes.update(billingContext(t, a), id, dto),
      'Discount type updated',
    );
  }
}
