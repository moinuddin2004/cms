import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { BillingClock } from '../common/billing-clock.service';
import { BillingLookups } from '../common/billing-lookups';
import { ChargeQueries } from '../charges/charges.queries';
import {
  ChargeResponse,
  PatientBillingSummary,
} from '../mappers/billing-response.types';
import {
  OutstandingRow,
  PatientBillingQueries,
  Statement,
} from './patient-billing.queries';

/** Patient billing tab and check-in badges (6.14, 6.23). Read only. */
@Injectable()
export class PatientBillingService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly clock: BillingClock,
  ) {}

  async summary(
    tenant: TenantContext,
    patientId: string,
  ): Promise<PatientBillingSummary> {
    await BillingLookups.patient(this.dataSource.manager, tenant, patientId);
    const { today } = await this.clock.read(tenant.locationId);
    return PatientBillingQueries.summary(
      this.dataSource.manager,
      tenant,
      patientId,
      today,
    );
  }

  /** Unbilled + billed with balance, FIFO — the collect sheet's rows. */
  async openCharges(
    tenant: TenantContext,
    patientId: string,
  ): Promise<ChargeResponse[]> {
    await BillingLookups.patient(this.dataSource.manager, tenant, patientId);
    return ChargeQueries.forPatient(
      this.dataSource.manager,
      tenant,
      patientId,
      'open',
    );
  }

  async statement(
    tenant: TenantContext,
    patientId: string,
    from?: string,
    to?: string,
  ): Promise<Statement> {
    await BillingLookups.patient(this.dataSource.manager, tenant, patientId);
    const { today } = await this.clock.read(tenant.locationId);
    return PatientBillingQueries.statement(
      this.dataSource.manager,
      tenant,
      patientId,
      from ?? null,
      to ?? null,
      today,
    );
  }

  async outstanding(
    tenant: TenantContext,
    patientIds: string[],
  ): Promise<OutstandingRow[]> {
    const { today } = await this.clock.read(tenant.locationId);
    return PatientBillingQueries.outstanding(
      this.dataSource.manager,
      tenant,
      patientIds,
      today,
    );
  }
}
