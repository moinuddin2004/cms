/* Supertest bodies are untyped JSON; these suites assert on their shape. */
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
import type { Response } from 'supertest';
import { EngineSeedService } from 'src/engine/seeds/engine-seed.service';
import { LabsFixture, createLabsFixture } from './labs-it.harness';

const code = (res: Response): string | undefined =>
  (res.body?.error?.code ?? res.body?.code) as string | undefined;

const CROWN_V1_ANSWERS = {
  teeth: [{ tooth: '16' }],
  material: 'zirconia_monolithic',
  shade_system: 'VITA_classical',
  shade: 'A2',
  impression_type: 'physical',
};

/** Sprint 2 — engine I: specialties, versioned form schemas, validator. */
describe('Engine integration — specialties and form schemas (API)', () => {
  let fx: LabsFixture;
  let dentalId: string;
  let crown: { id: string; current: { id: string } };

  beforeAll(async () => {
    fx = await createLabsFixture('labs_it_engine');
    const specialties = await fx.platform(
      'get',
      '/platform/specialties',
      fx.superAdmin,
    );
    dentalId = specialties.body.data.find(
      (s: { code: string }) => s.code === 'DENTAL',
    ).id;
    const forms = await fx.platform(
      'get',
      `/platform/form-schemas?owner=platform&specialtyId=${dentalId}`,
      fx.superAdmin,
    );
    crown = forms.body.data.find((f: { code: string }) => f.code === 'CROWN');
  }, 300_000);

  afterAll(async () => {
    await fx?.close();
  });

  const platform = (
    method: 'get' | 'post' | 'patch' | 'put' | 'delete',
    url: string,
    body?: object,
  ) => fx.platform(method, url, fx.superAdmin, body);

  describe('seeds', () => {
    it('boot created DENTAL and the five default forms, published v1', async () => {
      const res = await platform(
        'get',
        '/platform/form-schemas?owner=platform',
      );
      const codes = res.body.data.map((f: { code: string }) => f.code).sort();
      expect(codes).toEqual([
        'BRIDGE',
        'CROWN',
        'DENTURE',
        'IMPLANT_CROWN',
        'REPAIR',
      ]);
      for (const f of res.body.data) {
        expect(f.current.versionNo).toBe(1);
        expect(f.draft).toBeNull();
      }
    });

    it('re-running the seed creates nothing', async () => {
      expect(await fx.app.get(EngineSeedService).seed()).toBe(0);
    });
  });

  describe('clinic view', () => {
    it('every clinic role sees the published forms of enabled specialties', async () => {
      const A = fx.clinicA;
      const res = await fx.clinic(
        'get',
        '/form-schemas?specialty=dental',
        A,
        A.doctor,
      );
      expect(res.status).toBe(200);
      expect(res.body.data.map((f: { code: string }) => f.code)).toEqual([
        'BRIDGE',
        'CROWN',
        'DENTURE',
        'IMPLANT_CROWN',
        'REPAIR',
      ]);
      expect(res.body.data[0]).toMatchObject({
        specialtyCode: 'DENTAL',
        isOrganizationForm: false,
        versionNo: 1,
      });
    });

    it('validates answers server-side against a version', async () => {
      const A = fx.clinicA;
      const ok = await fx.clinic(
        'post',
        `/form-schemas/versions/${crown.current.id}/validate`,
        A,
        A.doctor,
        { data: CROWN_V1_ANSWERS },
      );
      expect(ok.body.data).toMatchObject({ ok: true, issues: [] });

      const bad = await fx.clinic(
        'post',
        `/form-schemas/versions/${crown.current.id}/validate`,
        A,
        A.doctor,
        { data: { ...CROWN_V1_ANSWERS, teeth: [{ tooth: '99' }] } },
      );
      expect(bad.body.data.ok).toBe(false);
      expect(bad.body.data.issues[0]).toMatchObject({
        path: 'teeth',
        code: 'invalid_tooth',
      });
    });

    it('a disabled specialty is refused; the platform switch wins over the default', async () => {
      const B = fx.clinicB;
      const off = await platform(
        'put',
        `/platform/specialties/${dentalId}/organizations/${B.organizationId}`,
        { isEnabled: false },
      );
      expect(off.status).toBe(200);

      const forms = await fx.clinic(
        'get',
        '/form-schemas?specialty=DENTAL',
        B,
        B.admin,
      );
      expect(code(forms)).toBe('SPECIALTY_NOT_ENABLED');
      expect(
        (await fx.clinic('get', '/specialties', B, B.admin)).body.data,
      ).toEqual([]);

      await platform(
        'put',
        `/platform/specialties/${dentalId}/organizations/${B.organizationId}`,
        { isEnabled: true },
      );
    });

    it('platform form routes are super-admin only', async () => {
      const res = await fx.platform(
        'get',
        '/platform/form-schemas',
        fx.clinicA.admin,
      );
      expect(res.status).toBe(403);
    });
  });

  describe('versioning', () => {
    let v2: { id: string; version: number };

    it('one draft at a time, copied from the newest version', async () => {
      const draft = await platform(
        'post',
        `/platform/form-schemas/${crown.id}/versions`,
        {},
      );
      expect(draft.status).toBe(201);
      expect(draft.body.data).toMatchObject({
        versionNo: 2,
        status: 'draft',
        issues: [],
      });
      expect(draft.body.data.schemaJson.fields.length).toBeGreaterThan(5);
      v2 = draft.body.data;

      const again = await platform(
        'post',
        `/platform/form-schemas/${crown.id}/versions`,
        {},
      );
      expect(code(again)).toBe('FORM_DRAFT_EXISTS');
    });

    it('drafts save with issues; publishing an invalid draft is refused', async () => {
      const url = `/platform/form-schemas/${crown.id}/versions/${v2.id}`;
      const current = (await platform('get', url)).body.data;
      const broken = await platform('patch', url, {
        schemaJson: {
          fields: [
            ...current.schemaJson.fields,
            {
              key: 'occlusion',
              type: 'select',
              label: 'Occlusion',
              options: [],
            },
          ],
        },
        uiJson: current.uiJson,
        promotions: current.promotions,
        version: current.version,
      });
      expect(broken.status).toBe(200);
      expect(
        broken.body.data.issues.map((i: { code: string }) => i.code),
      ).toContain('invalid_options');

      const publish = await platform('post', `${url}/publish`, {
        version: broken.body.data.version,
      });
      expect(code(publish)).toBe('FORM_DEFINITION_INVALID');
      expect(publish.body.error?.issues ?? publish.body.issues).toBeDefined();

      const stale = await platform('patch', url, {
        schemaJson: current.schemaJson,
        version: current.version,
      });
      expect(code(stale)).toBe('STALE_VERSION');

      const fixed = await platform('patch', url, {
        schemaJson: {
          fields: [
            ...current.schemaJson.fields,
            {
              key: 'occlusion',
              type: 'select',
              label: 'Occlusion',
              options: ['light', 'medium', 'heavy'],
              required: true,
            },
          ],
        },
        uiJson: null,
        promotions: current.promotions,
        version: broken.body.data.version,
      });
      expect(fixed.body.data.issues).toEqual([]);
      v2 = fixed.body.data;
    });

    it('publishing v2 retires v1; clinics move to v2 while v1 keeps validating', async () => {
      const url = `/platform/form-schemas/${crown.id}/versions/${v2.id}`;
      const published = await platform('post', `${url}/publish`, {
        version: v2.version,
      });
      expect(published.body.data).toMatchObject({
        status: 'published',
        versionNo: 2,
      });

      const detail = (
        await platform('get', `/platform/form-schemas/${crown.id}`)
      ).body.data;
      expect(
        detail.versions.map((v: { versionNo: number; status: string }) => [
          v.versionNo,
          v.status,
        ]),
      ).toEqual([
        [2, 'published'],
        [1, 'retired'],
      ]);

      const A = fx.clinicA;
      const current = await fx.clinic('get', '/form-schemas', A, A.admin);
      expect(
        current.body.data.find((f: { code: string }) => f.code === 'CROWN')
          .versionNo,
      ).toBe(2);

      // An order pinned to v1 still reads and validates against v1.
      const pinned = await fx.clinic(
        'post',
        `/form-schemas/versions/${crown.current.id}/validate`,
        A,
        A.admin,
        { data: CROWN_V1_ANSWERS },
      );
      expect(pinned.body.data.ok).toBe(true);
      // The same answers miss v2's new required field.
      const onV2 = await fx.clinic(
        'post',
        `/form-schemas/versions/${v2.id}/validate`,
        A,
        A.admin,
        { data: CROWN_V1_ANSWERS },
      );
      expect(
        onV2.body.data.issues.map((i: { path: string }) => i.path),
      ).toEqual(['occlusion']);
    });

    it('published and retired versions never change and cannot be deleted', async () => {
      const base = `/platform/form-schemas/${crown.id}/versions`;
      for (const id of [v2.id, crown.current.id]) {
        const edit = await platform('patch', `${base}/${id}`, {
          schemaJson: { fields: [] },
          version: 1,
        });
        expect(code(edit)).toBe('FORM_VERSION_NOT_DRAFT');
        const del = await platform('delete', `${base}/${id}`);
        expect(code(del)).toBe('FORM_VERSION_NOT_DRAFT');
      }
    });

    it('a draft can be discarded; clinics never see drafts', async () => {
      const draft = (
        await platform(
          'post',
          `/platform/form-schemas/${crown.id}/versions`,
          {},
        )
      ).body.data;
      const A = fx.clinicA;
      const peek = await fx.clinic(
        'get',
        `/form-schemas/versions/${draft.id}`,
        A,
        A.admin,
      );
      expect(peek.status).toBe(404);

      const del = await platform(
        'delete',
        `/platform/form-schemas/${crown.id}/versions/${draft.id}`,
      );
      expect(del.status).toBe(200);
      const detail = (
        await platform('get', `/platform/form-schemas/${crown.id}`)
      ).body.data;
      expect(detail.draft).toBeNull();

      const history = (
        await platform('get', `/platform/form-schemas/${crown.id}/history`)
      ).body.data as { action: string }[];
      expect(history.map((h) => h.action)).toContain('void');
    });
  });

  describe('organization forks', () => {
    it("a clinic's own form overrides the default for that clinic only", async () => {
      const A = fx.clinicA;
      const platformCrown = (
        await platform('get', `/platform/form-schemas/${crown.id}`)
      ).body.data;
      const fork = await platform('post', '/platform/form-schemas', {
        specialtyId: dentalId,
        organizationId: A.organizationId,
        code: 'crown',
        name: 'Crown (Clinic A)',
        copyFromVersionId: platformCrown.current.id,
      });
      expect(fork.status).toBe(201);
      expect(fork.body.data).toMatchObject({ code: 'CROWN', current: null });

      const dup = await platform('post', '/platform/form-schemas', {
        specialtyId: dentalId,
        organizationId: A.organizationId,
        code: 'CROWN',
        name: 'Again',
      });
      expect(code(dup)).toBe('FORM_SCHEMA_EXISTS');

      const draft = fork.body.data.draft;
      const published = await platform(
        'post',
        `/platform/form-schemas/${fork.body.data.id}/versions/${draft.id}/publish`,
        { version: 1 },
      );
      expect(published.status).toBe(201);

      const formsA = (await fx.clinic('get', '/form-schemas', A, A.admin)).body
        .data;
      expect(
        formsA.find((f: { code: string }) => f.code === 'CROWN'),
      ).toMatchObject({
        name: 'Crown (Clinic A)',
        isOrganizationForm: true,
      });

      const B = fx.clinicB;
      const formsB = (await fx.clinic('get', '/form-schemas', B, B.admin)).body
        .data;
      expect(
        formsB.find((f: { code: string }) => f.code === 'CROWN'),
      ).toMatchObject({
        isOrganizationForm: false,
      });
      const peek = await fx.clinic(
        'get',
        `/form-schemas/versions/${draft.id}`,
        B,
        B.admin,
      );
      expect(peek.status).toBe(404);
    });
  });
});
