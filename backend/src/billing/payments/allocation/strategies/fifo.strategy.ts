import { AllocationMode } from '../../../enums/billing.enums';
import { Paisa } from '../../../common/money';
import type { AllocationStrategy, PlannerCharge } from '../allocation.types';

/** AUTO: walk charges FIFO, each gets min(balance, remaining funds). */
export class FifoAllocationStrategy implements AllocationStrategy {
  readonly mode = AllocationMode.AUTO;

  targets(
    sortedCharges: readonly PlannerCharge[],
    totalFundsPaisa: Paisa,
  ): Map<string, Paisa> {
    const out = new Map<string, Paisa>();
    let left = totalFundsPaisa;
    for (const c of sortedCharges) {
      const take = Math.max(0, Math.min(c.balancePaisa, left));
      out.set(c.id, take);
      left -= take;
    }
    return out;
  }
}
