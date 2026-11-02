import { fromMinor, lineGross } from '../../common/money';
import { Charge } from '../../entities/charge.entity';
import {
  ChargeSource,
  ChargeStatus,
  ServiceKind,
} from '../../enums/billing.enums';
import { ResolvedPrice } from '../../catalog/charge-pricing.service';

/** Fields every new charge needs, whatever its source. */
export type ChargeDraft = Pick<
  Charge,
  | 'organizationId'
  | 'locationId'
  | 'patientId'
  | 'source'
  | 'sourceId'
  | 'encounterId'
  | 'appointmentId'
  | 'doctorId'
  | 'serviceId'
  | 'serviceKind'
  | 'description'
  | 'quantity'
  | 'unitPrice'
  | 'grossAmount'
  | 'discountAmount'
  | 'netAmount'
  | 'taxAmount'
  | 'allocatedAmount'
  | 'chargeDate'
  | 'needsPricing'
  | 'status'
  | 'createdBy'
  | 'invoiceId'
>;

interface Common {
  organizationId: string;
  locationId: string;
  patientId: string;
  chargeDate: string;
  createdBy: string | null;
  doctorId: string | null;
}

export interface VisitInput extends Common {
  encounterId: string;
  appointmentId: string | null;
}

export interface TreatmentInput extends VisitInput {
  treatmentId: string;
  treatmentName: string;
  legacyCost: number | null;
}

export interface PlanItemInput extends Common {
  planItemId: string;
  procedureName: string;
  estimatedCost: number | null;
}

export interface ManualInput extends Common {
  description: string;
  quantity: number;
  unitPrice: number;
}

/**
 * Every charge, whatever its source, is built here (Factory, 13.5): one
 * place for snapshot and defaulting rules. A missing price yields
 * `unitPrice = 0, needsPricing = true` (6.4).
 */
export class ChargeDraftFactory {
  fromConsultation(
    input: VisitInput,
    price: ResolvedPrice | null,
  ): ChargeDraft {
    return this.build(input, {
      source: ChargeSource.CONSULTATION,
      sourceId: input.encounterId,
      encounterId: input.encounterId,
      appointmentId: input.appointmentId,
      serviceId: price?.serviceId ?? null,
      serviceKind: price?.serviceKind ?? ServiceKind.CONSULTATION,
      description: price?.description ?? 'Consultation',
      quantity: 1,
      unitPrice: price?.unitPrice ?? 0,
      needsPricing: !price,
    });
  }

  fromTreatment(
    input: TreatmentInput,
    price: ResolvedPrice | null,
  ): ChargeDraft {
    const legacy =
      input.legacyCost != null && input.legacyCost > 0
        ? input.legacyCost
        : null;
    return this.build(input, {
      source: ChargeSource.TREATMENT,
      sourceId: input.treatmentId,
      encounterId: input.encounterId,
      appointmentId: input.appointmentId,
      serviceId: price?.serviceId ?? null,
      serviceKind: price?.serviceKind ?? ServiceKind.PROCEDURE,
      description: (price?.description ?? input.treatmentName).slice(0, 200),
      quantity: 1,
      unitPrice: price?.unitPrice ?? legacy ?? 0,
      needsPricing: !price && legacy === null,
    });
  }

  /** Plan items carry their own estimate (V16); otherwise use the catalog. */
  fromPlanItem(input: PlanItemInput, price: ResolvedPrice | null): ChargeDraft {
    const estimate =
      input.estimatedCost != null && input.estimatedCost > 0
        ? input.estimatedCost
        : null;
    return this.build(input, {
      source: ChargeSource.TREATMENT_PLAN,
      sourceId: input.planItemId,
      encounterId: null,
      appointmentId: null,
      serviceId: price?.serviceId ?? null,
      serviceKind: price?.serviceKind ?? ServiceKind.PROCEDURE,
      description: input.procedureName.slice(0, 200),
      quantity: 1,
      unitPrice: estimate ?? price?.unitPrice ?? 0,
      needsPricing: estimate === null && !price,
    });
  }

  /** Catalog service (price resolved) or "Other" (free text + price). */
  manual(input: ManualInput, price: ResolvedPrice | null): ChargeDraft {
    return this.build(input, {
      source: ChargeSource.MANUAL,
      sourceId: null,
      encounterId: null,
      appointmentId: null,
      serviceId: price?.serviceId ?? null,
      serviceKind: price?.serviceKind ?? ServiceKind.OTHER,
      description: (price?.description ?? input.description).slice(0, 200),
      quantity: input.quantity,
      unitPrice: price?.unitPrice ?? input.unitPrice,
      needsPricing: false,
    });
  }

  private build(
    common: Common,
    specific: Pick<
      ChargeDraft,
      | 'source'
      | 'sourceId'
      | 'encounterId'
      | 'appointmentId'
      | 'serviceId'
      | 'serviceKind'
      | 'description'
      | 'quantity'
      | 'unitPrice'
      | 'needsPricing'
    >,
  ): ChargeDraft {
    const gross = fromMinor(lineGross(specific.quantity, specific.unitPrice));
    return {
      organizationId: common.organizationId,
      locationId: common.locationId,
      patientId: common.patientId,
      doctorId: common.doctorId,
      chargeDate: common.chargeDate,
      createdBy: common.createdBy,
      ...specific,
      grossAmount: gross,
      discountAmount: 0,
      netAmount: gross,
      taxAmount: 0,
      allocatedAmount: 0,
      status: ChargeStatus.ACTIVE,
      invoiceId: null,
    };
  }
}
