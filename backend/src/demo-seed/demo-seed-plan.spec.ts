import { planDemoClinic, staffAction } from './demo-seed-plan';

describe('planDemoClinic', () => {
  it('fresh database: create everything', () => {
    expect(
      planDemoClinic({ ownerExists: false, orgExists: false, orgApproved: false, paymentRecorded: false }),
    ).toEqual({ createOwner: true, createClinic: true, approve: true, recordPayment: true });
  });

  it('owner created but the clinic was not: finish the clinic', () => {
    const p = planDemoClinic({ ownerExists: true, orgExists: false, orgApproved: false, paymentRecorded: false });
    expect(p).toEqual({ createOwner: false, createClinic: true, approve: true, recordPayment: true });
  });

  it('clinic exists but approval/payment failed: only those', () => {
    const p = planDemoClinic({ ownerExists: true, orgExists: true, orgApproved: false, paymentRecorded: true });
    expect(p).toEqual({ createOwner: false, createClinic: false, approve: true, recordPayment: false });
  });

  it('complete run: nothing to do', () => {
    const p = planDemoClinic({ ownerExists: true, orgExists: true, orgApproved: true, paymentRecorded: true });
    expect(p).toEqual({ createOwner: false, createClinic: false, approve: false, recordPayment: false });
  });
});

describe('staffAction', () => {
  it('reuses only when the user and the assignment both exist', () => {
    expect(staffAction({ userExists: true, hasAssignment: true })).toBe('reuse');
    expect(staffAction({ userExists: true, hasAssignment: false })).toBe('create');
    expect(staffAction({ userExists: false, hasAssignment: false })).toBe('create');
  });
});
