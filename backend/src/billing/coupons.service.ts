import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { Coupon } from './entities/coupon.entity';
import { Invoice } from './entities/invoice.entity';
import { CreateCouponDto, UpdateCouponDto } from './dto/coupon.dto';
import { InvoicesService } from './invoices.service';
import { InvoiceStatus } from './enums/billing.enums';

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(Coupon)
    private readonly couponRepo: Repository<Coupon>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    private readonly invoicesService: InvoicesService,
  ) {}

  // ── CRUD ───────────────────────────────────────────────────────────

  async create(
    organizationId: string,
    dto: CreateCouponDto,
    createdBy: string,
  ): Promise<Coupon> {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.couponRepo.findOne({
      where: { organizationId, code },
    });
    if (existing) {
      throw new ConflictException(`Coupon code "${code}" already exists`);
    }
    const coupon = this.couponRepo.create({
      ...dto,
      code,
      organizationId,
      createdBy,
      validFrom: new Date(dto.validFrom),
      validUntil: new Date(dto.validUntil),
    });
    return this.couponRepo.save(coupon);
  }

  async findAll(organizationId: string): Promise<Coupon[]> {
    return this.couponRepo.find({
      where: { organizationId, isActive: true },
      order: { validUntil: 'DESC' },
    });
  }

  async update(
    id: string,
    organizationId: string,
    dto: UpdateCouponDto,
  ): Promise<Coupon> {
    const coupon = await this.couponRepo.findOne({
      where: { id, organizationId },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');
    Object.assign(coupon, {
      ...dto,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : coupon.validFrom,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : coupon.validUntil,
    });
    return this.couponRepo.save(coupon);
  }

  async deactivate(id: string, organizationId: string): Promise<Coupon> {
    const coupon = await this.couponRepo.findOne({
      where: { id, organizationId },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');
    coupon.isActive = false;
    return this.couponRepo.save(coupon);
  }

  // ── Validation + application ───────────────────────────────────────

  async validateCoupon(
    code: string,
    organizationId: string,
    invoiceSubtotal: number,
  ): Promise<Coupon> {
    const coupon = await this.couponRepo.findOne({
      where: { organizationId, code: code.trim().toUpperCase() },
    });
    if (!coupon) throw new BadRequestException('Invalid coupon code');
    if (!coupon.isActive)
      throw new BadRequestException('This coupon is no longer active');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(coupon.validFrom) > today)
      throw new BadRequestException('This coupon is not valid yet');
    if (new Date(coupon.validUntil) < today)
      throw new BadRequestException('This coupon has expired');

    if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses)
      throw new BadRequestException('This coupon has reached its usage limit');

    if (
      coupon.minInvoiceAmount != null &&
      invoiceSubtotal < num(coupon.minInvoiceAmount)
    ) {
      throw new BadRequestException(
        `A minimum invoice amount of ${num(coupon.minInvoiceAmount)} is required for this coupon`,
      );
    }

    return coupon;
  }

  async applyCouponToInvoice(
    invoiceId: string,
    ctx: TenantContext,
    code: string,
  ): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({
      where: {
        id: invoiceId,
        organizationId: ctx.organizationId,
        locationId: ctx.locationId,
      },
      relations: ['items'],
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException(
        'Coupons can only be applied to draft invoices',
      );
    }

    const coupon = await this.validateCoupon(
      code,
      ctx.organizationId,
      num(invoice.subtotal),
    );

    invoice.couponId = coupon.id;
    invoice.discountType = coupon.discountType;
    invoice.discountValue = num(coupon.discountValue);
    await this.invoicesService.recalculateTotals(invoice);

    coupon.usedCount += 1;
    await this.couponRepo.save(coupon);

    return this.invoicesService.findOne(
      invoiceId,
      ctx.organizationId,
      ctx.locationId,
    );
  }

  async removeCouponFromInvoice(
    invoiceId: string,
    ctx: TenantContext,
  ): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({
      where: {
        id: invoiceId,
        organizationId: ctx.organizationId,
        locationId: ctx.locationId,
      },
      relations: ['items'],
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    if (invoice.couponId) {
      const coupon = await this.couponRepo.findOne({
        where: { id: invoice.couponId },
      });
      if (coupon && coupon.usedCount > 0) {
        coupon.usedCount -= 1;
        await this.couponRepo.save(coupon);
      }
    }

    invoice.couponId = null;
    invoice.discountType = null;
    invoice.discountValue = 0;
    invoice.discountAmount = 0;
    await this.invoicesService.recalculateTotals(invoice);

    return this.invoicesService.findOne(
      invoiceId,
      ctx.organizationId,
      ctx.locationId,
    );
  }
}
