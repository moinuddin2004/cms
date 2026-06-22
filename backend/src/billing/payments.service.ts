import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { Invoice } from './entities/invoice.entity';
import { Payment } from './entities/payment.entity';
import { RecordPaymentDto } from './dto/payment.dto';
import { InvoiceStatus } from './enums/billing.enums';

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const PAYABLE_STATUSES = [
  InvoiceStatus.PENDING,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.OVERDUE,
];

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Record a payment against an invoice and update its running balance,
   * atomically. Credit-package deductions are handled separately via the
   * patient-credits endpoints.
   */
  async recordPayment(
    invoiceId: string,
    ctx: TenantContext,
    dto: RecordPaymentDto,
    receivedBy: string,
  ): Promise<Payment> {
    const { organizationId, locationId } = ctx;

    return this.dataSource.transaction(async (manager) => {
      const invoice = await manager.findOne(Invoice, {
        where: { id: invoiceId, organizationId, locationId },
      });
      if (!invoice) throw new NotFoundException('Invoice not found');

      if (!PAYABLE_STATUSES.includes(invoice.status)) {
        throw new BadRequestException(
          `Cannot record a payment for an invoice with status ${invoice.status}`,
        );
      }
      if (dto.amount <= 0) {
        throw new BadRequestException('Payment amount must be greater than 0');
      }
      const balanceDue = num(invoice.balanceDue);
      if (dto.amount > balanceDue + 0.001) {
        throw new BadRequestException(
          `Payment exceeds the outstanding balance (${balanceDue})`,
        );
      }

      const payment = manager.create(Payment, {
        invoiceId,
        organizationId,
        locationId,
        patientId: invoice.patientId,
        receivedBy,
        amount: dto.amount,
        paymentMethod: dto.paymentMethod,
        referenceNumber: dto.referenceNumber ?? null,
        paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
        notes: dto.notes ?? null,
      });
      const savedPayment = await manager.save(payment);

      const paidAmount = round2(num(invoice.paidAmount) + dto.amount);
      const newBalance = round2(num(invoice.totalAmount) - paidAmount);
      invoice.paidAmount = paidAmount;
      invoice.balanceDue = newBalance;
      if (newBalance <= 0) {
        invoice.status = InvoiceStatus.PAID;
        invoice.paidDate = new Date();
      } else {
        invoice.status = InvoiceStatus.PARTIALLY_PAID;
      }
      await manager.save(invoice);

      return savedPayment;
    });
  }

  async getByInvoice(invoiceId: string): Promise<Payment[]> {
    return this.paymentRepo.find({
      where: { invoiceId },
      relations: ['receiver'],
      order: { paymentDate: 'DESC' },
    });
  }

  async getByPatient(
    patientId: string,
    organizationId: string,
  ): Promise<Payment[]> {
    return this.paymentRepo.find({
      where: { patientId, organizationId },
      relations: ['invoice'],
      order: { paymentDate: 'DESC' },
    });
  }

  async getDailyCollection(
    ctx: TenantContext,
    date: string,
  ): Promise<{ total: number; byMethod: Record<string, number> }> {
    const rows = await this.paymentRepo
      .createQueryBuilder('p')
      .select('p.payment_method', 'method')
      .addSelect('COALESCE(SUM(p.amount), 0)', 'sum')
      .where('p.organization_id = :organizationId', {
        organizationId: ctx.organizationId,
      })
      .andWhere('p.location_id = :locationId', { locationId: ctx.locationId })
      .andWhere('p.payment_date = :date', { date })
      .groupBy('p.payment_method')
      .getRawMany();

    const byMethod: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
      const amt = num(r.sum);
      byMethod[r.method] = amt;
      total += amt;
    }
    return { total: round2(total), byMethod };
  }
}
