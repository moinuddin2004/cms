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
import { ClinicActor, CurrentClinicActor } from 'src/labs/common/clinic-actor';
import {
  AddBillLineDto,
  AgingQueryDto,
  AllocatePaymentDto,
  ApproveBillDto,
  BillsQueryDto,
  CaseProfitQueryDto,
  CreatePaymentDto,
  CreateStatementDto,
  MonthlyCostQueryDto,
  PaymentsQueryDto,
  ReasonVersionDto,
  StatementsQueryDto,
  StatementStatusDto,
  UpdateBillDto,
} from '../dto/payables.dto';
import { LabStatementsService } from '../services/lab-statements.service';
import { PayablesReportsService } from '../services/payables-reports.service';
import { VendorBillsService } from '../services/vendor-bills.service';
import { VendorPaymentsService } from '../services/vendor-payments.service';

/**
 * Clinic finance for labs (lab ERD §6b, §15): vendor bills, payments,
 * monthly statements and reports. `lab.payables.manage` — the
 * accountant's desk.
 */
@Controller('lab-payables')
@Can('lab.payables.manage')
export class LabPayablesController {
  constructor(
    private readonly bills: VendorBillsService,
    private readonly payments: VendorPaymentsService,
    private readonly statements: LabStatementsService,
    private readonly reports: PayablesReportsService,
  ) {}

  // ── bills ────────────────────────────────────────────────────────────

  @Get('bills')
  async listBills(@ActiveTenant() t: TenantContext, @Query() q: BillsQueryDto) {
    return ResponseWrapper.success(await this.bills.list(t.organizationId, q));
  }

  @Get('bills/:id')
  async bill(
    @ActiveTenant() t: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return ResponseWrapper.success(
      await this.bills.detail(t.organizationId, id),
    );
  }

  @Patch('bills/:id')
  async updateBill(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBillDto,
  ) {
    return ResponseWrapper.success(
      await this.bills.update({ tenant, actor, ref }, id, dto),
      'Bill updated',
    );
  }

  @Post('bills/:id/lines')
  async addLine(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddBillLineDto,
  ) {
    return ResponseWrapper.success(
      await this.bills.addLine({ tenant, actor, ref }, id, dto),
      'Line added',
    );
  }

  @Post('orders/:orderId/sync')
  @HttpCode(HttpStatus.OK)
  async syncOrder(
    @ActiveTenant() t: TenantContext,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return ResponseWrapper.success(
      await this.bills.syncOrder(t.organizationId, orderId),
    );
  }

  @Post('bills/:id/approve')
  @HttpCode(HttpStatus.OK)
  async approve(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveBillDto,
  ) {
    return ResponseWrapper.success(
      await this.bills.approve({ tenant, actor, ref }, id, dto),
      'Bill approved',
    );
  }

  @Post('bills/:id/void')
  @HttpCode(HttpStatus.OK)
  async voidBill(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonVersionDto,
  ) {
    return ResponseWrapper.success(
      await this.bills.void({ tenant, actor, ref }, id, dto),
      'Bill voided',
    );
  }

  // ── payments ─────────────────────────────────────────────────────────

  @Get('payments')
  async listPayments(
    @ActiveTenant() t: TenantContext,
    @Query() q: PaymentsQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.payments.list(t.organizationId, q),
    );
  }

  @Get('payments/:id')
  async payment(
    @ActiveTenant() t: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return ResponseWrapper.success(
      await this.payments.detail(t.organizationId, id),
    );
  }

  @Post('payments')
  async pay(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Body() dto: CreatePaymentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return ResponseWrapper.success(
      await this.payments.create({ tenant, actor, ref }, dto, idempotencyKey),
      'Payment recorded',
    );
  }

  @Post('payments/:id/allocations')
  async allocate(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AllocatePaymentDto,
  ) {
    return ResponseWrapper.success(
      await this.payments.allocate({ tenant, actor, ref }, id, dto),
      'Payment allocated',
    );
  }

  @Post('payments/:id/reverse')
  @HttpCode(HttpStatus.OK)
  async reverse(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonVersionDto,
  ) {
    return ResponseWrapper.success(
      await this.payments.reverse({ tenant, actor, ref }, id, dto),
      'Payment reversed',
    );
  }

  // ── statements ───────────────────────────────────────────────────────

  @Get('statements')
  async listStatements(
    @ActiveTenant() t: TenantContext,
    @Query() q: StatementsQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.statements.list(t.organizationId, q),
    );
  }

  @Get('statements/:id')
  async statement(
    @ActiveTenant() t: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return ResponseWrapper.success(
      await this.statements.detail(t.organizationId, id),
    );
  }

  @Post('statements')
  async createStatement(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Body() dto: CreateStatementDto,
  ) {
    return ResponseWrapper.success(
      await this.statements.create({ tenant, actor, ref }, dto),
      'Statement reconciled',
    );
  }

  @Post('statements/:id/status')
  @HttpCode(HttpStatus.OK)
  async statementStatus(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StatementStatusDto,
  ) {
    return ResponseWrapper.success(
      await this.statements.setStatus({ tenant, actor, ref }, id, dto),
    );
  }

  // ── reports ──────────────────────────────────────────────────────────

  @Get('reports/aging')
  async aging(@ActiveTenant() t: TenantContext, @Query() q: AgingQueryDto) {
    return ResponseWrapper.success(
      await this.reports.aging(t.organizationId, t.locationId, q),
    );
  }

  @Get('reports/monthly-cost')
  async monthly(
    @ActiveTenant() t: TenantContext,
    @Query() q: MonthlyCostQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.reports.monthlyCost(t.organizationId, q),
    );
  }

  @Get('reports/case-profit')
  async caseProfit(
    @ActiveTenant() t: TenantContext,
    @Query() q: CaseProfitQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.reports.caseProfit(t.organizationId, t.locationId, q),
    );
  }
}
