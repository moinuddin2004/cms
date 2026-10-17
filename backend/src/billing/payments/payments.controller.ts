import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { RequireFeature } from 'src/common/decorators/require-feature.decorator';
import { CurrentActor, Roles } from 'src/common/decorators/roles.decorator';
import { Actor, AppRole } from 'src/common/enums/app-role.enum';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { BILLING_FEATURE } from '../billing.constants';
import { billingContext } from '../common/billing-context';
import {
  ApplyAdvanceDto,
  CollectPaymentDto,
  DailyCollectionQueryDto,
  ListPaymentsQueryDto,
  PreviewPaymentDto,
  UnapplyPaymentDto,
} from '../dto/payment.dto';
import { CreateRefundDto, ListRefundsQueryDto } from '../dto/refund.dto';
import { RefundsService } from '../refunds/refunds.service';
import { PaymentsService } from './payments.service';

/** Payments, advance and refunds (7.4). Payments are immutable (D12). */
@Controller()
@RequireFeature(BILLING_FEATURE)
@Roles(AppRole.CLINIC_ADMIN, AppRole.RECEPTIONIST)
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly refunds: RefundsService,
  ) {}

  @Post('payments/preview')
  async preview(
    @ActiveTenant() t: TenantContext,
    @CurrentActor() a: Actor,
    @Body() dto: PreviewPaymentDto,
  ) {
    return ResponseWrapper.success(
      await this.payments.preview(billingContext(t, a), dto),
      'Payment preview',
    );
  }

  @Post('payments')
  async collect(
    @ActiveTenant() t: TenantContext,
    @CurrentActor() a: Actor,
    @Body() dto: CollectPaymentDto,
  ) {
    return ResponseWrapper.success(
      await this.payments.collect(billingContext(t, a), dto),
      'Payment received',
    );
  }

  @Get('payments')
  async list(
    @ActiveTenant() t: TenantContext,
    @Query() q: ListPaymentsQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.payments.list(t, q),
      'Payments fetched',
    );
  }

  @Get('payments/daily-collection')
  async dailyCollection(
    @ActiveTenant() t: TenantContext,
    @Query() q: DailyCollectionQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.payments.dailyCollection(t, q.date),
      'Daily collection fetched',
    );
  }

  @Get('payments/:paymentId')
  async detail(
    @ActiveTenant() t: TenantContext,
    @Param('paymentId', ParseUUIDPipe) id: string,
  ) {
    return ResponseWrapper.success(
      await this.payments.detail(t, id),
      'Payment fetched',
    );
  }

  @Post('payments/:paymentId/unapply')
  async unapply(
    @ActiveTenant() t: TenantContext,
    @CurrentActor() a: Actor,
    @Param('paymentId', ParseUUIDPipe) id: string,
    @Body() dto: UnapplyPaymentDto,
  ) {
    return ResponseWrapper.success(
      await this.payments.unapply(billingContext(t, a), id, dto),
      'Payment released to advance',
    );
  }

  @Post('patients/:patientId/advance/apply')
  async applyAdvance(
    @ActiveTenant() t: TenantContext,
    @CurrentActor() a: Actor,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() dto: ApplyAdvanceDto,
  ) {
    return ResponseWrapper.success(
      await this.payments.applyAdvance(billingContext(t, a), patientId, dto),
      'Advance applied',
    );
  }

  @Post('refunds')
  async refund(
    @ActiveTenant() t: TenantContext,
    @CurrentActor() a: Actor,
    @Body() dto: CreateRefundDto,
  ) {
    return ResponseWrapper.success(
      await this.refunds.createAdvanceRefund(billingContext(t, a), dto),
      'Refund recorded',
    );
  }

  @Get('refunds')
  async listRefunds(
    @ActiveTenant() t: TenantContext,
    @Query() q: ListRefundsQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.refunds.list(t, q),
      'Refunds fetched',
    );
  }

  @Get('refunds/:refundId')
  async refundDetail(
    @ActiveTenant() t: TenantContext,
    @Param('refundId', ParseUUIDPipe) id: string,
  ) {
    return ResponseWrapper.success(
      await this.refunds.detail(t, id),
      'Refund fetched',
    );
  }
}
