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
import { CurrentActor, Roles } from 'src/common/decorators/roles.decorator';
import { Actor, AppRole } from 'src/common/enums/app-role.enum';
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

/** Billing configuration (7.1). Reads: admin + reception; writes: admin. */
@Controller('billing')
@RequireFeature(BILLING_FEATURE)
@Roles(AppRole.CLINIC_ADMIN, AppRole.RECEPTIONIST)
export class BillingConfigController {
  constructor(
    private readonly catalog: CatalogServicesService,
    private readonly settings: BillingSettingsService,
    private readonly accounts: PaymentAccountsService,
    private readonly discountTypes: DiscountTypesService,
  ) {}

  // ─── Services and prices ──────────────────────────────────────────

  @Get('services')
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
  @Roles(AppRole.CLINIC_ADMIN)
  async createService(
    @ActiveTenant() t: TenantContext,
    @CurrentActor() a: Actor,
    @Body() dto: CreateServiceDto,
  ) {
    return ResponseWrapper.success(
      await this.catalog.create(billingContext(t, a), dto),
      'Service created',
    );
  }

  @Patch('services/:serviceId')
  @Roles(AppRole.CLINIC_ADMIN)
  async updateService(
    @ActiveTenant() t: TenantContext,
    @CurrentActor() a: Actor,
    @Param('serviceId', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return ResponseWrapper.success(
      await this.catalog.update(billingContext(t, a), id, dto),
      'Service updated',
    );
  }

  @Get('services/:serviceId/resolved-price')
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
  @Roles(AppRole.CLINIC_ADMIN)
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
  @Roles(AppRole.CLINIC_ADMIN)
  async createPrice(
    @ActiveTenant() t: TenantContext,
    @CurrentActor() a: Actor,
    @Body() dto: CreateServicePriceDto,
  ) {
    return ResponseWrapper.success(
      await this.catalog.createPrice(billingContext(t, a), dto),
      'Price override created',
    );
  }

  @Patch('service-prices/:id')
  @Roles(AppRole.CLINIC_ADMIN)
  async updatePrice(
    @ActiveTenant() t: TenantContext,
    @CurrentActor() a: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServicePriceDto,
  ) {
    return ResponseWrapper.success(
      await this.catalog.updatePrice(billingContext(t, a), id, dto),
      'Price updated',
    );
  }

  @Delete('service-prices/:id')
  @Roles(AppRole.CLINIC_ADMIN)
  async deletePrice(
    @ActiveTenant() t: TenantContext,
    @CurrentActor() a: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.catalog.deletePrice(billingContext(t, a), id);
    return ResponseWrapper.success(null, 'Price override removed');
  }

  // ─── Settings ─────────────────────────────────────────────────────

  @Get('settings')
  async getSettings(@ActiveTenant() t: TenantContext) {
    return ResponseWrapper.success(
      await this.settings.get(t),
      'Billing settings fetched',
    );
  }

  @Patch('settings')
  @Roles(AppRole.CLINIC_ADMIN)
  async updateSettings(
    @ActiveTenant() t: TenantContext,
    @CurrentActor() a: Actor,
    @Body() dto: UpdateBillingSettingsDto,
  ) {
    return ResponseWrapper.success(
      await this.settings.update(billingContext(t, a), dto),
      'Billing settings saved',
    );
  }

  // ─── Payment accounts ─────────────────────────────────────────────

  @Get('payment-accounts')
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
  @Roles(AppRole.CLINIC_ADMIN)
  async createAccount(
    @ActiveTenant() t: TenantContext,
    @CurrentActor() a: Actor,
    @Body() dto: CreatePaymentAccountDto,
  ) {
    return ResponseWrapper.success(
      await this.accounts.create(billingContext(t, a), dto),
      'Payment account created',
    );
  }

  @Patch('payment-accounts/:id')
  @Roles(AppRole.CLINIC_ADMIN)
  async updateAccount(
    @ActiveTenant() t: TenantContext,
    @CurrentActor() a: Actor,
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
  @RequireFeature(DISCOUNTS_FEATURE)
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
  @Roles(AppRole.CLINIC_ADMIN)
  async createDiscountType(
    @ActiveTenant() t: TenantContext,
    @CurrentActor() a: Actor,
    @Body() dto: CreateDiscountTypeDto,
  ) {
    return ResponseWrapper.success(
      await this.discountTypes.create(billingContext(t, a), dto),
      'Discount type created',
    );
  }

  @Patch('discount-types/:id')
  @RequireFeature(DISCOUNTS_FEATURE)
  @Roles(AppRole.CLINIC_ADMIN)
  async updateDiscountType(
    @ActiveTenant() t: TenantContext,
    @CurrentActor() a: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDiscountTypeDto,
  ) {
    return ResponseWrapper.success(
      await this.discountTypes.update(billingContext(t, a), id, dto),
      'Discount type updated',
    );
  }
}
