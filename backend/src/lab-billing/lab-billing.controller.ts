import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Can } from 'src/access/decorators/access.decorators';
import { ActorRef, ActorSide } from 'src/common/audit/audit.enums';
import { RequestActor } from 'src/common/audit/request-actor.decorator';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import type { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { ClinicCall } from 'src/lab-orders/common/order-context';
import { ClinicActor, CurrentClinicActor } from 'src/labs/common/clinic-actor';
import { requireKey } from './common/lab-billing-errors';
import {
  ApplyAdvanceDto,
  CollectPaymentDto,
  CreateInvoiceDto,
  CreditNoteDto,
  IssueInvoiceDto,
  ListInvoicesQueryDto,
  ListPaymentsQueryDto,
  ReasonDto,
  RefundDto,
  SettingsDto,
  UpdateInvoiceDto,
  VoidInvoiceDto,
} from './dto/lab-billing.dto';
import { LabBillingQueries } from './services/lab-billing-queries.service';
import { LabCreditsService } from './services/lab-credits.service';
import { LabInvoicesService } from './services/lab-invoices.service';
import { LabPaymentsService } from './services/lab-payments.service';

/**
 * Patient billing for lab work (lab ERD §6a, §10, §15). `lab.billing.manage`
 * estimates, issues and collects; corrections that undo money also need the
 * patient-billing key for that act (void / credit note →
 * `billing.invoice.void`, reversal / refund → `billing.refund.issue`), and
 * settings need `admin.settings.manage`. Every money-moving POST needs
 * `Idempotency-Key`.
 */
@Controller('lab-billing')
@Can('lab.billing.manage')
export class LabBillingController {
  constructor(
    private readonly invoices: LabInvoicesService,
    private readonly payments: LabPaymentsService,
    private readonly credits: LabCreditsService,
    private readonly queries: LabBillingQueries,
  ) {}

  // ── invoices ─────────────────────────────────────────────────────────

  @Get('invoices')
  async list(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Query() q: ListInvoicesQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.queries.listInvoices({ tenant, actor, ref }, q),
    );
  }

  /** Estimate from a lab order (or manual lines); `issue: true` issues at once. */
  @Post('invoices')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Body() dto: CreateInvoiceDto,
  ) {
    const c: ClinicCall = { tenant, actor, ref };
    const id = await this.invoices.create(c, dto);
    return ResponseWrapper.success(
      await this.queries.invoice(c, id),
      dto.issue ? 'Invoice issued' : 'Estimate saved',
    );
  }

  @Get('invoices/:id')
  async get(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return ResponseWrapper.success(
      await this.queries.invoice({ tenant, actor, ref }, id),
    );
  }

  @Patch('invoices/:id')
  async update(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    const c: ClinicCall = { tenant, actor, ref };
    await this.invoices.update(c, id, dto);
    return ResponseWrapper.success(
      await this.queries.invoice(c, id),
      'Estimate saved',
    );
  }

  @Post('invoices/:id/issue')
  @HttpCode(HttpStatus.OK)
  async issue(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IssueInvoiceDto,
  ) {
    const c: ClinicCall = { tenant, actor, ref };
    await this.invoices.issue(c, id, dto);
    return ResponseWrapper.success(
      await this.queries.invoice(c, id),
      'Invoice issued',
    );
  }

  @Post('invoices/:id/void')
  @HttpCode(HttpStatus.OK)
  @Can('billing.invoice.void')
  async void(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidInvoiceDto,
  ) {
    const c: ClinicCall = { tenant, actor, ref };
    await this.invoices.void(c, id, dto);
    return ResponseWrapper.success(
      await this.queries.invoice(c, id),
      'Invoice voided',
    );
  }

  @Post('invoices/:id/apply-advance')
  @HttpCode(HttpStatus.OK)
  async applyAdvance(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApplyAdvanceDto,
    @Headers('idempotency-key') key?: string,
  ) {
    const c: ClinicCall = { tenant, actor, ref };
    await this.payments.applyAdvance(c, id, dto, requireKey(key));
    return ResponseWrapper.success(
      await this.queries.invoice(c, id),
      'Advance applied',
    );
  }

  @Post('invoices/:id/credit-notes')
  @HttpCode(HttpStatus.CREATED)
  @Can('billing.invoice.void')
  async creditNote(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreditNoteDto,
    @Headers('idempotency-key') key?: string,
  ) {
    const c: ClinicCall = { tenant, actor, ref };
    await this.credits.creditNote(c, id, dto, requireKey(key));
    return ResponseWrapper.success(
      await this.queries.invoice(c, id),
      'Credit note issued',
    );
  }

  /** §16 outstanding payment reminder → outbox (skipped while patient messages are off). */
  @Post('invoices/:id/remind')
  @HttpCode(HttpStatus.OK)
  async remind(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const rows = await this.invoices.remind({ tenant, actor, ref }, id);
    return ResponseWrapper.success(
      rows.map((r) => ({
        channel: r.channel,
        status: r.status,
        reason: r.reason,
      })),
    );
  }

  // ── payments ─────────────────────────────────────────────────────────

  @Get('payments')
  async listPayments(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Query() q: ListPaymentsQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.queries.listPayments({ tenant, actor, ref }, q),
    );
  }

  /** Lab ERD §10 "Patient payment". `Idempotency-Key` required (inv. 10). */
  @Post('payments')
  @HttpCode(HttpStatus.CREATED)
  async collect(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Body() dto: CollectPaymentDto,
    @Headers('idempotency-key') key?: string,
  ) {
    const c: ClinicCall = { tenant, actor, ref };
    const id = await this.payments.collect(c, dto, requireKey(key));
    return ResponseWrapper.success(
      await this.queries.payment(c, id),
      'Payment received',
    );
  }

  @Get('payments/:id')
  async payment(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return ResponseWrapper.success(
      await this.queries.payment({ tenant, actor, ref }, id),
    );
  }

  /** Lab ERD §10 "Payment reversal". Returns the reversal row. */
  @Post('payments/:id/reverse')
  @HttpCode(HttpStatus.OK)
  @Can('billing.refund.issue')
  async reverse(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @Headers('idempotency-key') key?: string,
  ) {
    const c: ClinicCall = { tenant, actor, ref };
    const reversalId = await this.payments.reverse(c, id, dto, requireKey(key));
    return ResponseWrapper.success(
      await this.queries.payment(c, reversalId),
      'Payment reversed',
    );
  }

  @Post('refunds')
  @HttpCode(HttpStatus.CREATED)
  @Can('billing.refund.issue')
  async refund(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Body() dto: RefundDto,
    @Headers('idempotency-key') key?: string,
  ) {
    const c: ClinicCall = { tenant, actor, ref };
    const id = await this.credits.refund(c, dto, requireKey(key));
    return ResponseWrapper.success(
      { id, summary: await this.queries.patientSummary(c, dto.patientId) },
      'Refund recorded',
    );
  }

  // ── panels / summaries / settings ────────────────────────────────────

  @Get('orders/:orderId')
  async order(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return ResponseWrapper.success(
      await this.queries.order({ tenant, actor, ref }, orderId),
    );
  }

  @Get('patients/:patientId/summary')
  async patient(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('patientId', ParseUUIDPipe) patientId: string,
  ) {
    return ResponseWrapper.success(
      await this.queries.patientSummary({ tenant, actor, ref }, patientId),
    );
  }

  @Get('settings')
  async settings(@ActiveTenant() tenant: TenantContext) {
    return ResponseWrapper.success(
      await this.invoices.readSettings(tenant.organizationId),
    );
  }

  @Patch('settings')
  @Can('admin.settings.manage')
  async updateSettings(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Body() dto: SettingsDto,
  ) {
    return ResponseWrapper.success(
      await this.invoices.updateSettings({ tenant, actor, ref }, dto),
      'Settings saved',
    );
  }
}
