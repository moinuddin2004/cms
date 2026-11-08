// TEMP (billing agent) — billing invariants over the kept seedcheck_a schema. Delete after use.
import './lib/time-travel';
import 'src/bootstrap/utc';
import { bootSeedApp } from './lib/seed-app';
import { BillingInvariantChecker } from 'src/billing/invariants/billing-invariant-checker';

async function main() {
  const app = await bootSeedApp();
  try {
    const rows = await app.ds.query(`SELECT DISTINCT organization_id o, location_id l, patient_id p FROM charges`);
    const checker = app.get(BillingInvariantChecker);
    let bad = 0;
    for (const r of rows) {
      const v = await checker.checkPatient(app.ds.manager, { organizationId: r.o, locationId: r.l }, r.p);
      if (v.length) { bad++; console.log(r.p, v.map((x: any) => `${x.invariant}: ${x.message}`)); }
    }
    console.log(`checked ${rows.length} patient-locations, ${bad} with violations`);
  } finally {
    await app.app.close().catch(() => {});
  }
}
main().catch((e) => console.error('DEBUG FAILED', e));
