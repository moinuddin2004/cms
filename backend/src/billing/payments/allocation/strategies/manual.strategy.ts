import { AllocationMode } from '../../../enums/billing.enums';
import { Paisa, sumPaisa } from '../../../common/money';
import {
  AllocationInput,
  AllocationPlanError,
  type AllocationStrategy,
  type PlannerCharge,
} from '../allocation.types';

/** MANUAL: each charge gets exactly what the user typed (6.5). */
export class ManualAllocationStrategy implements AllocationStrategy {
  readonly mode = AllocationMode.MANUAL;

  targets(
    sortedCharges: readonly PlannerCharge[],
    totalFundsPaisa: Paisa,
    input: AllocationInput,
  ): Map<string, Paisa> {
    const out = new Map<string, Paisa>();
    for (const c of sortedCharges) {
      const requested = input.requested?.get(c.id) ?? 0;
      if (requested > c.balancePaisa) {
        throw new AllocationPlanError(
          'BILLING_ALLOCATION_EXCEEDS_BALANCE',
          'An amount is larger than the charge balance',
        );
      }
      out.set(c.id, requested);
    }
    if (sumPaisa([...out.values()]) > totalFundsPaisa) {
      throw new AllocationPlanError(
        'BILLING_ALLOCATION_EXCEEDS_FUNDS',
        'The amounts add up to more than the money available',
      );
    }
    return out;
  }
}
