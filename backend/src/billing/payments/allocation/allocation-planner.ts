import { AllocationMode } from '../../enums/billing.enums';
import { sumMinor } from '../../common/money';
import {
  AllocationInput,
  AllocationPlan,
  AllocationStrategy,
  NEW_PAYMENT,
  PlannedLine,
  PlannerCharge,
} from './allocation.types';
import { FifoAllocationStrategy } from './strategies/fifo.strategy';
import { ManualAllocationStrategy } from './strategies/manual.strategy';

/**
 * Allocation planning (D7, 6.5 step 4). Pure: the functional core of
 * collecting money. Strategies decide HOW MUCH each charge gets; the
 * planner then draws that from funding sources in order (old advance
 * oldest first, then the new payment).
 */

export const ALLOCATION_STRATEGIES: Readonly<
  Record<AllocationMode, AllocationStrategy>
> = {
  [AllocationMode.AUTO]: new FifoAllocationStrategy(),
  [AllocationMode.MANUAL]: new ManualAllocationStrategy(),
};

/** FIFO: oldest charge date first, then creation time (D7). */
export const fifoOrder = (charges: readonly PlannerCharge[]): PlannerCharge[] =>
  [...charges].sort(
    (a, b) =>
      a.chargeDate.localeCompare(b.chargeDate) ||
      a.createdAt - b.createdAt ||
      a.id.localeCompare(b.id),
  );

export function planAllocation(
  mode: AllocationMode,
  input: AllocationInput,
): AllocationPlan {
  const charges = fifoOrder(input.charges);
  const totalFunds = sumMinor(input.funds.map((f) => f.availableMinor));
  const targets = ALLOCATION_STRATEGIES[mode].targets(
    charges,
    totalFunds,
    input,
  );

  const funds = input.funds.map((f) => ({ ...f, left: f.availableMinor }));
  const lines: PlannedLine[] = [];
  for (const charge of charges) {
    let need = targets.get(charge.id) ?? 0;
    for (const fund of funds) {
      if (need === 0) break;
      const take = Math.min(need, fund.left);
      if (take === 0) continue;
      lines.push({
        chargeId: charge.id,
        source: fund.source,
        amountMinor: take,
      });
      fund.left -= take;
      need -= take;
    }
  }

  const newFund = funds.find((f) => f.source === NEW_PAYMENT);
  return {
    lines,
    perCharge: targets,
    advanceUsedMinor: sumMinor(
      lines.filter((l) => l.source !== NEW_PAYMENT).map((l) => l.amountMinor),
    ),
    newPaymentAdvanceMinor: newFund ? newFund.left : 0,
  };
}

export * from './allocation.types';
