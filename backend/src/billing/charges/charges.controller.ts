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
import { billingContext } from '../common/billing-context';
import {
  ChargesFromPlanDto,
  CreateManualChargeDto,
  ListChargesQueryDto,
  ReadyToBillQueryDto,
  ReasonDto,
  UpdateChargeDto,
} from '../dto/charge.dto';
import { ApplyDiscountDto, BulkDiscountDto } from '../dto/discount.dto';
import { ChargesService } from './charges.service';

/** Unbilled charges (7.2). Doctors get 403 on every route (D17). */
@Controller()
@RequireFeature(BILLING_FEATURE)
@Roles(AppRole.CLINIC_ADMIN, AppRole.RECEPTIONIST)
export class ChargesController {
  constructor(private readonly charges: ChargesService) {}

  @Get('patients/:patientId/charges')
  async list(
    @ActiveTenant() t: TenantContext,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Query() q: ListChargesQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.charges.list(t, patientId, q.state ?? 'open'),
      'Charges fetched',
    );
  }

  @Post('patients/:patientId/charges')
  async addManual(
    @ActiveTenant() t: TenantContext,
    @CurrentActor() a: Actor,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() dto: CreateManualChargeDto,
  ) {
    return ResponseWrapper.success(
      await this.charges.addManual(billingContext(t, a), patientId, dto),
      'Charge added',
    );
  }

  @Post('patients/:patientId/charges/from-treatment-plan/:planId')
  async fromPlan(
    @ActiveTenant() t: TenantContext,
    @CurrentActor() a: Actor,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() dto: ChargesFromPlanDto,
  ) {
    const rows = await this.charges.fromTreatmentPlan(
      billingContext(t, a),
      patientId,
      planId,
      dto.itemIds,
    );
    return ResponseWrapper.success(rows, `${rows.length} charge(s) added`);
  }

  @Patch('charges/:chargeId')
  async update(
    @ActiveTenant() t: TenantContext,
    @CurrentActor() a: Actor,
    @Param('chargeId', ParseUUIDPipe) chargeId: string,
    @Body() dto: UpdateChargeDto,
  ) {
    return ResponseWrapper.success(
      await this.charges.update(billingContext(t, a), chargeId, dto),
      'Charge updated',
    );
  }

  @Post('charges/discount/bulk')
  @RequireFeature(DISCOUNTS_FEATURE)
  async bulkDiscount(
    @ActiveTenant() t: TenantContext,
    @CurrentActor() a: Actor,
    @Body() dto: BulkDiscountDto,
  ) {
    return ResponseWrapper.success(
      await this.charges.bulkDiscount(billingContext(t, a), dto),
      'Discount applied',
    );
  }

  @Post('charges/:chargeId/discount')
  @RequireFeature(DISCOUNTS_FEATURE)
  async setDiscount(
    @ActiveTenant() t: TenantContext,
    @CurrentActor() a: Actor,
    @Param('chargeId', ParseUUIDPipe) chargeId: string,
    @Body() dto: ApplyDiscountDto,
  ) {
    return ResponseWrapper.success(
      await this.charges.setDiscount(billingContext(t, a), chargeId, dto),
      'Discount applied',
    );
  }

  @Delete('charges/:chargeId/discount')
  @RequireFeature(DISCOUNTS_FEATURE)
  async removeDiscount(
    @ActiveTenant() t: TenantContext,
    @CurrentActor() a: Actor,
    @Param('chargeId', ParseUUIDPipe) chargeId: string,
  ) {
    return ResponseWrapper.success(
      await this.charges.removeDiscount(billingContext(t, a), chargeId),
      'Discount removed',
    );
  }

  @Post('charges/:chargeId/void')
  async void(
    @ActiveTenant() t: TenantContext,
    @CurrentActor() a: Actor,
    @Param('chargeId', ParseUUIDPipe) chargeId: string,
    @Body() dto: ReasonDto,
  ) {
    return ResponseWrapper.success(
      await this.charges.void(billingContext(t, a), chargeId, dto.reason),
      'Charge voided',
    );
  }

  @Get('billing/ready-to-bill')
  async readyToBill(
    @ActiveTenant() t: TenantContext,
    @Query() q: ReadyToBillQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.charges.readyToBill(t, q.date),
      'Ready to bill fetched',
    );
  }
}
