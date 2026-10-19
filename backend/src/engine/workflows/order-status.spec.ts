import { deriveOrderStatus, isDerivable } from './order-status';

const derive = (itemStatuses: string[], onHold = false) =>
  deriveOrderStatus({ itemStatuses, onHold });

describe('order status derivation (lab ERD §9)', () => {
  it.each<[string[], string]>([
    [['cancelled', 'cancelled'], 'cancelled'],
    [['approved', 'delivered'], 'completed'],
    [['received', 'approved'], 'under_review'],
    [['received', 'in_production'], 'partially_received'],
    [['ready', 'dispatched'], 'ready'],
    // Acceptance test: one item ready, the other in production.
    [['ready', 'in_production'], 'partially_ready'],
    [['accepted', 'qc'], 'in_progress'],
    [['at_clinic_tryin', 'accepted'], 'in_progress'],
    [['accepted', 'accepted'], 'accepted'],
    [['accepted', 'pending_acceptance'], 'submitted'],
    [['pending_acceptance'], 'submitted'],
  ])('%j → %s', (items, expected) => {
    expect(derive(items)).toBe(expected);
  });

  it('cancelled, rejected and remade items do not count', () => {
    expect(derive(['ready', 'cancelled'])).toBe('ready');
    expect(derive(['approved', 'remake_required', 'in_production'])).toBe(
      'partially_received',
    );
    expect(derive(['rejected', 'accepted'])).toBe('accepted');
    expect(derive(['rejected', 'cancelled'])).toBe('submitted');
  });

  it('a manual hold wins over progress, but not over full cancellation', () => {
    expect(derive(['ready', 'in_production'], true)).toBe('on_hold');
    expect(derive(['cancelled'], true)).toBe('cancelled');
  });

  it('never overrides manual or terminal statuses', () => {
    for (const s of [
      'draft',
      'clarification_needed',
      'rejected_by_lab',
      'cancelled',
      'completed',
    ]) {
      expect(isDerivable(s)).toBe(false);
    }
    for (const s of ['submitted', 'in_progress', 'on_hold', 'under_review']) {
      expect(isDerivable(s)).toBe(true);
    }
  });
});
