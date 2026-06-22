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
  Res,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { InvoicesService } from './invoices.service';
import { PaymentsService } from './payments.service';
import { CouponsService } from './coupons.service';
import { ReceiptPdfService } from './receipt-pdf.service';
import { PaymentGatewayService } from './payment-gateway.service';
import {
  CreateInvoiceDto,
  UpdateInvoiceDto,
  AddInvoiceItemDto,
  InvoiceFilterDto,
  UpdateInvoiceStatusDto,
  ApplyCouponDto,
} from './dto/invoice.dto';
import { RecordPaymentDto } from './dto/payment.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { RequireFeature } from 'src/common/decorators/require-feature.decorator';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';

@Controller('invoices')
@RequireFeature('billing.invoices')
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly paymentsService: PaymentsService,
    private readonly couponsService: CouponsService,
    private readonly receiptPdfService: ReceiptPdfService,
    private readonly paymentGatewayService: PaymentGatewayService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateInvoiceDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.invoicesService.create(ctx, dto, req.user?.uuid);
    return ResponseWrapper.success(data, 'Invoice created successfully');
  }

  @Get()
  async findAll(
    @Query() query: InvoiceFilterDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.invoicesService.findAll(ctx, query);
    return ResponseWrapper.success(data, 'Invoices retrieved successfully');
  }

  @Get('stats')
  async getStats(@ActiveTenant() ctx: TenantContext) {
    const data = await this.invoicesService.getStats(ctx);
    return ResponseWrapper.success(data);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.invoicesService.findOne(
      id,
      ctx.organizationId,
      ctx.locationId,
    );
    return ResponseWrapper.success(data, 'Invoice retrieved successfully');
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInvoiceDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.invoicesService.update(id, ctx, dto);
    return ResponseWrapper.success(data, 'Invoice updated successfully');
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInvoiceStatusDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.invoicesService.updateStatus(id, ctx, dto.status);
    return ResponseWrapper.success(data, 'Invoice status updated successfully');
  }

  @Post(':id/items')
  @HttpCode(HttpStatus.CREATED)
  async addItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddInvoiceItemDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.invoicesService.addItem(id, ctx, dto);
    return ResponseWrapper.success(data, 'Item added successfully');
  }

  @Delete(':id/items/:itemId')
  async removeItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.invoicesService.removeItem(id, itemId, ctx);
    return ResponseWrapper.success(data, 'Item removed successfully');
  }

  @Post('from-treatment-plan/:planId')
  @HttpCode(HttpStatus.CREATED)
  async generateFromTreatmentPlan(
    @Param('planId', ParseUUIDPipe) planId: string,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.invoicesService.generateFromTreatmentPlan(
      planId,
      ctx,
      req.user?.uuid,
    );
    return ResponseWrapper.success(data, 'Invoice generated from treatment plan');
  }

  // ── Payments ───────────────────────────────────────────────────────

  @Post(':id/payments')
  @HttpCode(HttpStatus.CREATED)
  async recordPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordPaymentDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.paymentsService.recordPayment(
      id,
      ctx,
      dto,
      req.user?.uuid,
    );
    return ResponseWrapper.success(data, 'Payment recorded successfully');
  }

  @Get(':id/payments')
  async getPayments(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.paymentsService.getByInvoice(id);
    return ResponseWrapper.success(data);
  }

  // ── Coupons ────────────────────────────────────────────────────────

  @Post(':id/apply-coupon')
  async applyCoupon(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApplyCouponDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.couponsService.applyCouponToInvoice(
      id,
      ctx,
      dto.code,
    );
    return ResponseWrapper.success(data, 'Coupon applied successfully');
  }

  @Delete(':id/remove-coupon')
  async removeCoupon(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.couponsService.removeCouponFromInvoice(id, ctx);
    return ResponseWrapper.success(data, 'Coupon removed successfully');
  }

  // ── Receipt PDF ────────────────────────────────────────────────────

  @Get(':id/receipt-pdf')
  async receiptPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @Res() res: Response,
  ) {
    const { buffer, fileName } =
      await this.receiptPdfService.generateReceiptPdf(id, ctx);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Content-Length': String(buffer.length),
    });
    res.end(buffer);
  }

  // ── Online payment link (placeholder) ──────────────────────────────

  @Post(':id/payment-link')
  async paymentLink(@Param('id', ParseUUIDPipe) id: string) {
    const data = this.paymentGatewayService.createPaymentLink(id);
    return ResponseWrapper.success(data, 'Payment link generated');
  }
}
