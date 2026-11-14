export type TodayBlockId = 'stats' | 'collections' | 'doctors' | 'next';

type CanFn = (perm: string) => boolean;
type HasFeatureFn = (key: string) => boolean;

/**
 * Ordered blocks of S-01 the user may see (docs/06): stats, collections,
 * doctors now, next appointments. Pure; the screen renders exactly these.
 * Collections needs `billing.invoice.view`; the daily summary additionally
 * wants `reports.financial.view` + feature `billing.financial_summary`, but the
 * invoice-stats fallback keeps the block visible without them.
 */
export function visibleTodayBlocks(can: CanFn, hasFeature: HasFeatureFn): TodayBlockId[] {
  // A permission already implies its feature in the access context, so no
  // block is hidden by `hasFeature` today; kept in the contract for S-01.
  void hasFeature;
  const blocks: TodayBlockId[] = [];
  if (can('appointments.view')) blocks.push('stats');
  if (can('billing.invoice.view')) blocks.push('collections');
  if (can('queue.board.view')) blocks.push('doctors');
  if (can('appointments.view')) blocks.push('next');
  return blocks;
}
