/**
 * Platform approval of a clinic. Self-signup clinics start PENDING and can't
 * be used (every tenant request is refused) until a super admin approves
 * them. Clinics created by a super admin, and every clinic that existed
 * before approvals, are APPROVED.
 */
export enum ClinicApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}
