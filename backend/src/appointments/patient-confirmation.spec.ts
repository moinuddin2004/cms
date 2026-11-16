import { clearConfirmationOnReschedule } from './patient-confirmation';

describe('clearConfirmationOnReschedule', () => {
  it('clears the confirmation when the time changed', () => {
    const a = { patientConfirmedAt: new Date('2026-11-15T08:00:00Z') };
    clearConfirmationOnReschedule(a, true);
    expect(a.patientConfirmedAt).toBeNull();
  });

  it('keeps it when only notes / type changed', () => {
    const at = new Date('2026-11-15T08:00:00Z');
    const a = { patientConfirmedAt: at };
    clearConfirmationOnReschedule(a, false);
    expect(a.patientConfirmedAt).toBe(at);
  });
});
