/**
 * Feature flag gating the clinic side of lab management. The key predates
 * the module (it was seeded as an unused "Lab Orders" flag); kept so orgs
 * that already enabled it keep it. Platform (super admin) routes ignore it.
 */
export const LAB_FEATURE = 'dental.lab_orders';

export const DEFAULT_PAYMENT_TERMS_DAYS = 30;
