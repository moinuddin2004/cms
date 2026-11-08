import type { SeedContext } from '../lib/context';
import { seedClinics, seedPlatform } from './01-clinics-staff';
import { seedPatients } from './02-patients';
import { seedBillingSetup } from './03-billing-setup';
import * as billingSetup from './03-billing-setup';
import { seedLabsSetup } from './04-labs-setup';
import { seedInventory } from './05-inventory';
import { seedLabOrders } from './07-lab-orders';
import { seedBillingExtras } from './08-billing-extras';
import { seedTidy } from './98-tidy';

export interface SeedStep {
  name: string;
  /** Optional steps have a group (see SEED_ONLY in run.ts); core steps don't. */
  group?: string;
  run: (ctx: SeedContext) => Promise<void>;
  /**
   * Re-adds this step's `ctx.hooks` (e.g. billing's end-of-day). Called in the
   * main process after the step, and in every visits child process.
   */
  registerHooks?: (ctx: SeedContext) => void;
}

/** Before the visits: everything the clinic days need. */
export const SETUP_STEPS: SeedStep[] = [
  { name: 'platform (super admin)', run: seedPlatform },
  { name: 'clinics, locations, staff', run: seedClinics },
  { name: 'patients', run: seedPatients },
  {
    name: 'billing setup',
    group: 'billing',
    run: seedBillingSetup,
    registerHooks: (billingSetup as any).registerBillingHooks,
  },
  { name: 'labs setup', group: 'labs', run: seedLabsSetup },
  { name: 'inventory', group: 'inventory', run: seedInventory },
];

/** Group of the visits step (run per clinic, in parallel — see run.ts). */
export const VISITS_GROUP = 'visits';

/** After the visits: things that use the history. */
export const AFTER_STEPS: SeedStep[] = [
  { name: 'lab orders', group: 'labs', run: seedLabOrders },
  { name: 'billing extras (expenses, payroll, settlements)', group: 'billing', run: seedBillingExtras },
  { name: 'tidy up (notifications, realtime outbox)', run: seedTidy },
];

export const ALL_STEPS = [...SETUP_STEPS, ...AFTER_STEPS];
