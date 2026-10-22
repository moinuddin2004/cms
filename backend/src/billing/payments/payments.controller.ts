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
import type { AccessContext } from 'src/access/access-context';
import { Access, Can } from 'src/access/decorators/access.decorators';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
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
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly refunds: RefundsService,
  ) {}

  @Post('payments/preview')
  @Can('billing.payment.collect')
  async preview(
    @ActiveTenant() t: TenantContext,
    @Access() a: AccessContext,
    @Body() dto: PreviewPaymentDto,
  ) {
    return ResponseWrapper.success(
      await this.payments.preview(billingContext(t, a), dto),
      'Payment preview',
    );
  }

  @Post('payments')
  @Can('billing.payment.collect')
  async collect(
    @ActiveTenant() t: TenantContext,
    @Access() a: AccessContext,
    @Body() dto: CollectPaymentDto,
  ) {
    return ResponseWrapper.success(
      await this.payments.collect(billingContext(t, a), dto),
      'Payment received',
    );
  }

  @Get('payments')
  @Can('billing.invoice.view')
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
  @Can('billing.desk.use')
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
  @Can('billing.invoice.view')
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
  @Can('billing.invoice.edit')
  async unapply(
    @ActiveTenant() t: TenantContext,
    @Access() a: AccessContext,
    @Param('paymentId', ParseUUIDPipe) id: string,
    @Body() dto: UnapplyPaymentDto,
  ) {
    return ResponseWrapper.success(
      await this.payments.unapply(billingContext(t, a), id, dto),
      'Payment released to advance',
    );
  }

  @Post('patients/:patientId/advance/apply')
  @Can('billing.payment.collect')
  async applyAdvance(
    @ActiveTenant() t: TenantContext,
    @Access() a: AccessContext,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() dto: ApplyAdvanceDto,
  ) {
    return ResponseWrapper.success(
      await this.payments.applyAdvance(billingContext(t, a), patientId, dto),
      'Advance applied',
    );
  }

  @Post('refunds')
  @Can('billing.refund.issue')
  async refund(
    @ActiveTenant() t: TenantContext,
    @Access() a: AccessContext,
    @Body() dto: CreateRefundDto,
  ) {
    return ResponseWrapper.success(
      await this.refunds.createAdvanceRefund(billingContext(t, a), dto),
      'Refund recorded',
    );
  }

  @Get('refunds')
  @Can('billing.invoice.view')
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
  @Can('billing.invoice.view')
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
