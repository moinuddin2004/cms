import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThan } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { AppLogger } from 'src/common/services/logger.service';
import { PatientCredit } from './entities/patient-credit.entity';
import { CreditStatus } from './enums/billing.enums';
import { CreditPackagesService } from './credit-packages.service';
import { BillingClock } from './common/billing-clock.service';

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

@Injectable()
export class PatientCreditsService {
  constructor(
    @InjectRepository(PatientCredit)
    private readonly creditRepo: Repository<PatientCredit>,
    private readonly packagesService: CreditPackagesService,
    private readonly logger: AppLogger,
    private readonly clinicClock: BillingClock,
  ) {}

  async purchasePackage(
    patientId: string,
    packageId: string,
    organizationId: string,
    locationId: string,
    soldBy: string,
  ): Promise<PatientCredit> {
    const pkg = await this.packagesService.getOrFail(packageId, organizationId);

    // `purchase_date` / `expiry_date` are `date` columns: the clinic's day.
    const { today } = await this.clinicClock.read(locationId);
    const asDate = (ymd: string) => new Date(`${ymd}T00:00:00Z`);
    const purchaseDate = asDate(today);
    let expiryDate: Date | null = null;
    if (pkg.validityDays != null) {
      expiryDate = asDate(this.clinicClock.addDays(today, pkg.validityDays));
    }

    const credit = this.creditRepo.create({
      patientId,
      organizationId,
      creditPackageId: pkg.id,
      purchasedBy: soldBy,
      totalAmount: num(pkg.totalCredits),
      usedAmount: 0,
      remainingAmount: num(pkg.totalCredits),
      purchaseDate,
      expiryDate,
      status: CreditStatus.ACTIVE,
    });
    return this.creditRepo.save(credit);
  }

  async getPatientCredits(
    patientId: string,
    organizationId: string,
  ): Promise<PatientCredit[]> {
    const credits = await this.creditRepo.find({
      where: { patientId, organizationId },
      relations: ['creditPackage'],
      order: { purchaseDate: 'DESC' },
    });
    // ACTIVE first, then by most recent purchase.
    const rank = (s: CreditStatus) => (s === CreditStatus.ACTIVE ? 0 : 1);
    return credits.sort((a, b) => rank(a.status) - rank(b.status));
  }

  async useCredit(
    patientCreditId: string,
    organizationId: string,
    amount: number,
  ): Promise<PatientCredit> {
    const credit = await this.creditRepo.findOne({
      where: { id: patientCreditId, organizationId },
    });
    if (!credit) throw new NotFoundException('Patient credit not found');

    if (credit.status !== CreditStatus.ACTIVE) {
      throw new BadRequestException('This credit package is not active');
    }
    if (credit.expiryDate && new Date(credit.expiryDate) < new Date()) {
      credit.status = CreditStatus.EXPIRED;
      await this.creditRepo.save(credit);
      throw new BadRequestException('This credit package has expired');
    }
    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }
    if (amount > num(credit.remainingAmount) + 0.001) {
      throw new BadRequestException(
        `Amount exceeds the remaining balance (${num(credit.remainingAmount)})`,
      );
    }

    credit.usedAmount = round2(num(credit.usedAmount) + amount);
    credit.remainingAmount = round2(num(credit.remainingAmount) - amount);
    if (credit.remainingAmount <= 0) {
      credit.status = CreditStatus.EXHAUSTED;
    }
    return this.creditRepo.save(credit);
  }

  @Cron('0 1 * * *')
  async checkExpiredCredits(): Promise<void> {
    // Global sweep across orgs: the UTC calendar date is accepted here (a
    // credit may flip a few hours off the clinic's local midnight).
    const today = new Date().toISOString().slice(0, 10);

    const expired = await this.creditRepo.find({
      where: {
        status: In([CreditStatus.ACTIVE]),
        // `expiry_date` is a `date` column — compare as 'YYYY-MM-DD'.
        expiryDate: LessThan(today as unknown as Date),
      },
    });
    if (expired.length === 0) return;

    for (const c of expired) c.status = CreditStatus.EXPIRED;
    await this.creditRepo.save(expired);
    this.logger.info(
      `Expired ${expired.length} patient credit(s)`,
      PatientCreditsService.name,
    );
  }
}
