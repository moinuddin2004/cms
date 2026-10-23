import {
  addComponents,
  buildProfitLoss,
  changePct,
  emptyComponents,
  PnlComponents,
} from './profit-loss';

const month = (over: Partial<PnlComponents>): PnlComponents => ({
  ...emptyComponents(),
  ...over,
});

describe('profit & loss', () => {
  const c = month({
    clinicCollected: 500_000_00,
    labCollected: 40_000_00,
    clinicBilled: 620_000_00,
    labBilled: 55_000_00,
    labCost: 30_000_00,
    commission: 60_000_00,
    salaries: 150_000_00,
    expenses: { RENT: 80_000_00, UTILITIES: 15_000_00, OTHER: 0 },
  });

  it('builds a collected-basis statement', () => {
    const pl = buildProfitLoss(c, 'collected');
    expect(pl.revenue).toEqual({
      clinic: 500_000_00,
      lab: 40_000_00,
      total: 540_000_00,
    });
    expect(pl.directCosts.total).toBe(90_000_00);
    expect(pl.grossProfit).toBe(450_000_00);
    expect(pl.operating.total).toBe(245_000_00);
    expect(pl.netProfit).toBe(205_000_00);
    expect(pl.totalCosts).toBe(335_000_00);
    expect(pl.marginPct).toBe(38);
    // zero categories are dropped, the rest largest first
    expect(pl.operating.expenses.map((e) => e.category)).toEqual([
      'RENT',
      'UTILITIES',
    ]);
  });

  it('uses billed revenue on the billed basis and reports both totals', () => {
    const pl = buildProfitLoss(c, 'billed');
    expect(pl.revenue.total).toBe(675_000_00);
    expect(pl.collected).toBe(540_000_00);
    expect(pl.billed).toBe(675_000_00);
    expect(pl.netProfit).toBe(675_000_00 - 335_000_00);
  });

  it('shows a loss and no margin without revenue', () => {
    const pl = buildProfitLoss(month({ salaries: 10_000_00 }), 'collected');
    expect(pl.netProfit).toBe(-10_000_00);
    expect(pl.marginPct).toBeNull();
  });

  it('rolls months up, merging expense categories', () => {
    const sum = addComponents(
      month({ clinicCollected: 100, expenses: { RENT: 10 } }),
      month({ clinicCollected: 50, expenses: { RENT: 5, SUPPLIES: 3 } }),
    );
    expect(sum.clinicCollected).toBe(150);
    expect(sum.expenses).toEqual({ RENT: 15, SUPPLIES: 3 });
  });

  it('computes change against the previous period', () => {
    expect(changePct(120, 100)).toBe(20);
    expect(changePct(-50, -100)).toBe(50);
    expect(changePct(10, 0)).toBeNull();
  });
});
