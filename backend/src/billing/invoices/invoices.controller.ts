import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
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
import { ReasonDto } from '../dto/charge.dto';
import {
  CreateInvoiceDto,
  DateRangeQueryDto,
  EditInvoiceDto,
  EditInvoicePreviewDto,
  ListInvoicesQueryDto,
} from '../dto/invoice.dto';
import { InvoiceRefundDto } from '../dto/refund.dto';
import { RefundsService } from '../refunds/refunds.service';
import { InvoicesService } from './invoices.service';

/** Invoices v2 (7.3). No status / total is ever accepted from the client (10.2). */
@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly refunds: RefundsService,
  ) {}

  @Get()
  @Can('billing.invoice.view')
  async list(
    @ActiveTenant() t: TenantContext,
    @Access() a: AccessContext,
    @Query() q: ListInvoicesQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.invoices.list(t, q, a),
      'Invoices fetched',
    );
  }

  @Get('stats')
  @Can('billing.invoice.view')
  async stats(@ActiveTenant() t: TenantContext, @Query() q: DateRangeQueryDto) {
    return ResponseWrapper.success(
      await this.invoices.stats(t, q.from, q.to),
      'Invoice stats fetched',
    );
  }

  @Get(':invoiceId')
  @Can('billing.invoice.view')
  async detail(
    @ActiveTenant() t: TenantContext,
    @Param('invoiceId', ParseUUIDPipe) id: string,
  ) {
    return ResponseWrapper.success(
      await this.invoices.detail(t, id),
      'Invoice fetched',
    );
  }

  @Get(':invoiceId/revisions/:revision')
  @Can('billing.invoice.view')
  async revision(
    @ActiveTenant() t: TenantContext,
    @Param('invoiceId', ParseUUIDPipe) id: string,
    @Param('revision', ParseIntPipe) revision: number,
  ) {
    return ResponseWrapper.success(
      await this.invoices.revision(t, id, revision),
      'Revision fetched',
    );
  }

  @Post()
  @Can('billing.desk.use')
  async create(
    @ActiveTenant() t: TenantContext,
    @Access() a: AccessContext,
    @Body() dto: CreateInvoiceDto,
  ) {
    return ResponseWrapper.success(
      await this.invoices.create(billingContext(t, a), dto),
      'Invoice issued',
    );
  }

  @Post(':invoiceId/edit/preview')
  @Can('billing.invoice.edit')
  async editPreview(
    @ActiveTenant() t: TenantContext,
    @Access() a: AccessContext,
    @Param('invoiceId', ParseUUIDPipe) id: string,
    @Body() dto: EditInvoicePreviewDto,
  ) {
    return ResponseWrapper.success(
      await this.invoices.editPreview(billingContext(t, a), id, dto),
      'Edit preview',
    );
  }

  @Post(':invoiceId/edit')
  @Can('billing.invoice.edit')
  async edit(
    @ActiveTenant() t: TenantContext,
    @Access() a: AccessContext,
    @Param('invoiceId', ParseUUIDPipe) id: string,
    @Body() dto: EditInvoiceDto,
  ) {
    return ResponseWrapper.success(
      await this.invoices.edit(billingContext(t, a), id, dto, dto.reason),
      'Invoice updated',
    );
  }

  @Post(':invoiceId/cancel')
  @Can('billing.invoice.void')
  async cancel(
    @ActiveTenant() t: TenantContext,
    @Access() a: AccessContext,
    @Param('invoiceId', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    return ResponseWrapper.success(
      await this.invoices.cancel(billingContext(t, a), id, dto.reason),
      'Invoice cancelled',
    );
  }

  @Post(':invoiceId/refund')
  @Can('billing.refund.issue')
  async refund(
    @ActiveTenant() t: TenantContext,
    @Access() a: AccessContext,
    @Param('invoiceId', ParseUUIDPipe) id: string,
    @Body() dto: InvoiceRefundDto,
  ) {
    return ResponseWrapper.success(
      await this.refunds.createInvoiceRefund(billingContext(t, a), id, dto),
      'Refund recorded',
    );
  }
}
