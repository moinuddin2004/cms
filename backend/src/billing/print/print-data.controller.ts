import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { RequireFeature } from 'src/common/decorators/require-feature.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AppRole } from 'src/common/enums/app-role.enum';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { BILLING_FEATURE } from '../billing.constants';
import { PrintInvoiceQueryDto, StatementQueryDto } from '../dto/report.dto';
import { PrintDataService } from './print-data.service';

/** Print payloads for browser-printed templates (9.1). */
@Controller('print')
@RequireFeature(BILLING_FEATURE)
@Roles(AppRole.CLINIC_ADMIN, AppRole.RECEPTIONIST)
export class PrintDataController {
  constructor(private readonly print: PrintDataService) {}

  @Get('invoices/:invoiceId')
  async invoice(
    @ActiveTenant() t: TenantContext,
    @Param('invoiceId', ParseUUIDPipe) id: string,
    @Query() q: PrintInvoiceQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.print.invoice(t, id, q.revision),
      'Invoice print data',
    );
  }

  @Get('payments/:paymentId')
  async receipt(
    @ActiveTenant() t: TenantContext,
    @Param('paymentId', ParseUUIDPipe) id: string,
  ) {
    return ResponseWrapper.success(
      await this.print.receipt(t, id),
      'Receipt print data',
    );
  }

  @Get('refunds/:refundId')
  async refund(
    @ActiveTenant() t: TenantContext,
    @Param('refundId', ParseUUIDPipe) id: string,
  ) {
    return ResponseWrapper.success(
      await this.print.refund(t, id),
      'Refund voucher print data',
    );
  }

  @Get('patients/:patientId/statement')
  async statement(
    @ActiveTenant() t: TenantContext,
    @Param('patientId', ParseUUIDPipe) id: string,
    @Query() q: StatementQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.print.statement(t, id, q.from, q.to),
      'Statement print data',
    );
  }

  @Get('cash-close/:id')
  async cashClose(
    @ActiveTenant() t: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return ResponseWrapper.success(
      await this.print.cashCloseSlip(t, id),
      'Cash close slip',
    );
  }
}
