import { bootApp, Env, note, seedWorld } from './harness';

/**
 * Extra probes found while reading the code for the acceptance run. They are
 * NOT cases of the test plan; results are reported separately as findings.
 */
describe('XTRA probes (not in the plan)', () => {
  let env: Env;
  let w: Env['world'];
  let enc: { doc1: string; doc2: string };

  beforeAll(async () => {
    env = await bootApp();
    w = await seedWorld(env, 'xtra');
    const rows = await env.ds.query<{ id: string; queue_entry_id: string }[]>(
      'SELECT id, queue_entry_id FROM patient_encounters WHERE organization_id = $1',
      [w.orgA],
    );
    enc = {
      doc1: rows.find((r) => r.queue_entry_id === w.encounters.doc1)!.id,
      doc2: rows.find((r) => r.queue_entry_id === w.encounters.doc2)!.id,
    };
  }, 900_000);
  afterAll(async () => env?.close());

  it("XTRA-01 GET /encounters/:id — a doctor reading another doctor's encounter (consultation.conduct is own, patients.clinical.view is unscoped)", async () => {
    const res = await env.get(`/encounters/${enc.doc1}`, w.people.Doc2);
    note('XTRA-01', `Doc2 → Doc1's encounter: ${res.status}`);
    expect([403, 404]).toContain(res.status);
  });

  it("XTRA-02 POST /encounters/:id/treatments — a doctor adding a treatment to another doctor's encounter", async () => {
    const res = await env.post(`/encounters/${enc.doc1}/treatments`, w.people.Doc2, {});
    note('XTRA-02', `Doc2 → Doc1's encounter treatment: ${res.status}`);
    // 400 = body validation ran, i.e. the request got past every access check.
    expect([403, 404]).toContain(res.status);
  });

  it('XTRA-01b the owning doctor, and a location-wide role, still reach the encounter', async () => {
    await env.get(`/encounters/${enc.doc1}`, w.people.Doc1).expect(200);
    await env.get(`/encounters/${enc.doc1}`, w.people.AdminU).expect(200);
    const mine = await env.post(`/encounters/${enc.doc1}/treatments`, w.people.Doc1, {});
    expect([400, 201]).toContain(mine.status); // past the access checks (body validation only)
  });

  it('XTRA-03 GET /payroll/location without month/year must be a 400, not a 500', async () => {
    const res = await env.get('/payroll/location', w.people.AdminU);
    note('XTRA-03', `AdminU GET /payroll/location (no params): ${res.status}`);
    expect(res.status).toBeLessThan(500);
  });
});
