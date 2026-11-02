import { AllocationMode } from '../../../enums/billing.enums';
import { Minor } from '../../../common/money';
import type { AllocationStrategy, PlannerCharge } from '../allocation.types';

/** AUTO: walk charges FIFO, each gets min(balance, remaining funds). */
export class FifoAllocationStrategy implements AllocationStrategy {
  readonly mode = AllocationMode.AUTO;

  targets(
    sortedCharges: readonly PlannerCharge[],
    totalFundsMinor: Minor,
  ): Map<string, Minor> {
    const out = new Map<string, Minor>();
    let left = totalFundsMinor;
    for (const c of sortedCharges) {
      const take = Math.max(0, Math.min(c.balanceMinor, left));
      out.set(c.id, take);
      left -= take;
    }
    return out;
  }
}
