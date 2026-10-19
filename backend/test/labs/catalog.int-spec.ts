/* Supertest bodies are untyped JSON; these suites assert on their shape. */
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
import type { Response } from 'supertest';
import { IsNull } from 'typeorm';
import { CatalogService } from 'src/billing/entities/catalog-service.entity';
import { ServicePrice } from 'src/billing/entities/service-price.entity';
import { ServiceKind } from 'src/billing/enums/billing.enums';
import { addDays, localDate } from 'src/common/clock/tz.util';
import { FormSchema } from 'src/engine/entities/form-schema.entity';
import { Specialty } from 'src/engine/entities/specialty.entity';
import { StageTemplate } from 'src/engine/entities/stage-template.entity';
import { WorkflowTemplate } from 'src/engine/entities/workflow-template.entity';
import { CATALOG_TIMEZONE } from 'src/lab-catalog/lab-catalog.constants';
import { LabCatalogModule } from 'src/lab-catalog/lab-catalog.module';
import { CatalogSeedService } from 'src/lab-catalog/seeds/catalog-seed.service';
import { Clinic, LabsFixture, createLabsFixture } from './labs-it.harness';

const code = (res: Response): string | undefined =>
  (res.body?.error?.code ?? res.body?.code) as string | undefined;

/** Sprint 5 — catalogs: lab services, prices, mappings, order templates. */
describe('Lab catalog integration (API)', () => {
  let fx: LabsFixture;
  let A: Clinic;
  let B: Clinic;
  const today = localDate(CATALOG_TIMEZONE, new Date());
  const tomorrow = addDays(today, 1);

  let dental: Specialty;
  let crownForm: FormSchema;
  let itemWorkflow: WorkflowTemplate;
  let pfmStages: StageTemplate;
  let crownCategoryId: string;
  let lab: { id: string };
  let service: { id: string; version: number };
  let option: { id: string };

  const platform = (
    method: 'get' | 'post' | 'patch',
    url: string,
    body?: object,
  ) => fx.platform(method, url, fx.superAdmin, body);
  const svcUrl = (rest = '') => `/platform/labs/${lab.id}/services${rest}`;

  beforeAll(async () => {
    fx = await createLabsFixture('labs_it_s5_catalog', [LabCatalogModule]);
    A = fx.clinicA;
    B = fx.clinicB;
    const m = fx.dataSource.manager;
    dental = await m
      .getRepository(Specialty)
      .findOneByOrFail({ code: 'DENTAL' });
    const platformDef = { specialtyId: dental.id, organizationId: IsNull() };
    crownForm = await m
      .getRepository(FormSchema)
      .findOneByOrFail({ ...platformDef, code: 'CROWN' });
    itemWorkflow = await m
      .getRepository(WorkflowTemplate)
      .findOneByOrFail({ ...platformDef, code: 'DENTAL_ITEM' });
    pfmStages = await m
      .getRepository(StageTemplate)
      .findOneByOrFail({ ...platformDef, code: 'PFM_3_STAGE' });

    const created = await platform('post', '/platform/labs', {
      name: 'Catalog IT Lab',
      labType: 'external',
      city: 'Karachi',
    });
    expect(created.status).toBe(201);
    lab = created.body.data;
  }, 300_000);

  afterAll(async () => {
    await fx?.close();
  });

  describe('categories', () => {
    it('boot seeded the dental categories; re-running creates nothing', async () => {
      const res = await platform(
        'get',
        `/platform/service-categories?specialtyId=${dental.id}`,
      );
      expect(res.status).toBe(200);
      const codes = res.body.data.map((c: { code: string }) => c.code);
      expect(codes).toEqual([
        'CROWN',
        'BRIDGE',
        'IMPLANT',
        'DENTURE',
        'ORTHO',
        'REPAIR',
      ]);
      crownCategoryId = res.body.data[0].id;
      expect(await fx.app.get(CatalogSeedService).seed()).toBe(0);
    });

    it('only super admins manage categories', async () => {
      const res = await fx.platform(
        'post',
        '/platform/service-categories',
        A.admin,
        { specialtyId: dental.id, code: 'VENEER', name: 'Veneers' },
      );
      expect(res.status).toBe(403);
      const dup = await platform('post', '/platform/service-categories', {
        specialtyId: dental.id,
        code: 'crown',
        name: 'Again',
      });
      expect(code(dup)).toBe('SERVICE_CATEGORY_EXISTS');
    });
  });

  describe('lab services (platform)', () => {
    it('creates a service wired to the engine definitions', async () => {
      const res = await platform('post', svcUrl(), {
        categoryId: crownCategoryId,
        code: 'zr_crown',
        name: 'Zirconia crown',
        unitType: 'per_tooth',
        defaultTurnaroundDays: 5,
        formSchemaId: crownForm.id,
        workflowTemplateId: itemWorkflow.id,
        stageTemplateId: pfmStages.id,
      });
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        code: 'ZR_CROWN',
        unitType: 'per_tooth',
        specialty: { code: 'DENTAL' },
        category: { code: 'CROWN' },
        formSchema: { code: 'CROWN' },
        workflowTemplate: { code: 'DENTAL_ITEM' },
        stageTemplate: { code: 'PFM_3_STAGE' },
        isActive: true,
        version: 1,
      });
      service = res.body.data;
    });

    it('refuses duplicates, wrong definitions and non-admins', async () => {
      const dup = await platform('post', svcUrl(), {
        categoryId: crownCategoryId,
        code: 'ZR_CROWN',
        name: 'Copy',
        unitType: 'per_tooth',
      });
      expect(code(dup)).toBe('LAB_SERVICE_EXISTS');

      const wrongForm = await platform('post', svcUrl(), {
        categoryId: crownCategoryId,
        code: 'BAD',
        name: 'Bad',
        unitType: 'per_tooth',
        formSchemaId: pfmStages.id,
      });
      expect(code(wrongForm)).toBe('LAB_SERVICE_DEFINITION_INVALID');

      const asClinic = await fx.platform('get', svcUrl(), A.admin);
      expect(asClinic.status).toBe(403);
    });

    it('updates with optimistic locking and records history', async () => {
      const ok = await platform('patch', svcUrl(`/${service.id}`), {
        name: 'Zirconia crown (monolithic)',
        version: 1,
      });
      expect(ok.body.data.version).toBe(2);
      const stale = await platform('patch', svcUrl(`/${service.id}`), {
        name: 'Lost update',
        version: 1,
      });
      expect(code(stale)).toBe('STALE_VERSION');
      service = ok.body.data;

      const history = await platform('get', svcUrl(`/${service.id}/history`));
      expect(
        history.body.data.map((h: { action: string }) => h.action),
      ).toEqual(['update', 'create']);
    });

    it('adds options with integer paisa costs', async () => {
      const res = await platform('post', svcUrl(`/${service.id}/options`), {
        optionType: 'material',
        code: 'layered',
        name: 'Layered porcelain',
        extraCostPaisa: 120_000,
      });
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        code: 'LAYERED',
        extraCostPaisa: 120_000,
      });
      option = res.body.data;

      const float = await platform('post', svcUrl(`/${service.id}/options`), {
        optionType: 'material',
        code: 'FLOAT',
        name: 'Float',
        extraCostPaisa: 10.5,
      });
      expect(float.status).toBe(400);
    });
  });

  describe('prices', () => {
    let listPrice: { id: string; version: number };

    it('sets the lab list price; no back-dating', async () => {
      const res = await platform('post', svcUrl(`/${service.id}/prices`), {
        unitPricePaisa: 500_000,
        rushSurchargePaisa: 100_000,
        effectiveFrom: today,
      });
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        organization: null,
        unitPricePaisa: 500_000,
        currency: 'PKR',
        effectiveFrom: today,
        effectiveTo: null,
      });
      listPrice = res.body.data;

      const past = await platform('post', svcUrl(`/${service.id}/prices`), {
        unitPricePaisa: 1,
        effectiveFrom: addDays(today, -1),
      });
      expect(code(past)).toBe('LAB_PRICE_INVALID');
    });

    it('a negotiated price needs the clinic linked to the lab', async () => {
      const res = await platform('post', svcUrl(`/${service.id}/prices`), {
        organizationId: A.organizationId,
        unitPricePaisa: 450_000,
        rushSurchargePaisa: 100_000,
        effectiveFrom: today,
      });
      expect(code(res)).toBe('LAB_NOT_LINKED');

      // A works with the lab (active); B has only invited it.
      const linkA = await fx.clinic('post', '/lab-links', A, A.admin, {
        labId: lab.id,
      });
      await fx.clinic(
        'post',
        `/lab-links/${linkA.body.data.id}/transitions`,
        A,
        A.admin,
        { action: 'activate', version: 1 },
      );
      await fx.clinic('post', '/lab-links', B, B.admin, { labId: lab.id });

      const ok = await platform('post', svcUrl(`/${service.id}/prices`), {
        organizationId: A.organizationId,
        unitPricePaisa: 450_000,
        rushSurchargePaisa: 100_000,
        effectiveFrom: today,
      });
      expect(ok.status).toBe(201);
      expect(ok.body.data.organization).toMatchObject({
        id: A.organizationId,
      });
    });

    it('a new open-ended price supersedes the running one from its start date', async () => {
      const res = await platform('post', svcUrl(`/${service.id}/prices`), {
        unitPricePaisa: 550_000,
        rushSurchargePaisa: 100_000,
        effectiveFrom: tomorrow,
      });
      expect(res.status).toBe(201);
      const prices = await platform('get', svcUrl(`/${service.id}/prices`));
      const list = prices.body.data.filter(
        (p: { organization: unknown }) => p.organization === null,
      );
      expect(
        list.map((p: { effectiveFrom: string; effectiveTo: string | null }) => [
          p.effectiveFrom,
          p.effectiveTo,
        ]),
      ).toEqual([
        [tomorrow, null],
        [today, today],
      ]);
    });

    it('refuses overlaps and edits to a price already in use', async () => {
      const overlap = await platform('post', svcUrl(`/${service.id}/prices`), {
        unitPricePaisa: 1,
        effectiveFrom: tomorrow,
        effectiveTo: addDays(tomorrow, 5),
      });
      expect(code(overlap)).toBe('LAB_PRICE_OVERLAP');

      const current = (
        await platform('get', svcUrl(`/${service.id}/prices`))
      ).body.data.find((p: { id: string }) => p.id === listPrice.id);
      const edit = await platform(
        'patch',
        svcUrl(`/${service.id}/prices/${listPrice.id}`),
        { unitPricePaisa: 1, version: current.version },
      );
      expect(code(edit)).toBe('LAB_PRICE_LOCKED');
      const voidRunning = await platform(
        'post',
        svcUrl(`/${service.id}/prices/${listPrice.id}/void`),
        { reason: 'mistake', version: current.version },
      );
      expect(code(voidRunning)).toBe('LAB_PRICE_LOCKED');
    });

    it('a future price can be voided; its history shows it', async () => {
      const future = await platform('post', svcUrl(`/${service.id}/prices`), {
        organizationId: A.organizationId,
        unitPricePaisa: 999_999,
        effectiveFrom: addDays(today, 30),
        effectiveTo: addDays(today, 40),
      });
      // Overlaps A's open-ended negotiated price, which started today.
      expect(code(future)).toBe('LAB_PRICE_OVERLAP');

      const later = await platform('post', svcUrl(`/${service.id}/prices`), {
        unitPricePaisa: 600_000,
        effectiveFrom: addDays(today, 60),
      });
      const voided = await platform(
        'post',
        svcUrl(`/${service.id}/prices/${later.body.data.id}/void`),
        { reason: 'Entered by mistake', version: later.body.data.version },
      );
      expect(voided.status).toBe(201);
      expect(voided.body.data.voidReason).toBe('Entered by mistake');
      // Voiding restores the price it had superseded (open-ended again).
      const prices = await platform('get', svcUrl(`/${service.id}/prices`));
      expect(
        prices.body.data.find(
          (p: { organization: unknown; effectiveFrom: string }) =>
            p.organization === null && p.effectiveFrom === tomorrow,
        ).effectiveTo,
      ).toBeNull();
      const history = await platform(
        'get',
        svcUrl(`/${service.id}/prices/${later.body.data.id}/history`),
      );
      expect(
        history.body.data.map((h: { action: string }) => h.action),
      ).toEqual(['void', 'create']);
    });
  });

  describe('clinic catalog view', () => {
    it("each clinic sees its own price — never another clinic's rate", async () => {
      const a = await fx.clinic('get', '/lab-catalog/services', A, A.doctor);
      expect(a.status).toBe(200);
      const rowA = a.body.data.data.find(
        (s: { id: string }) => s.id === service.id,
      );
      expect(rowA.price).toMatchObject({
        source: 'negotiated',
        unitPricePaisa: 450_000,
      });
      expect(rowA.options.map((o: { code: string }) => o.code)).toEqual([
        'LAYERED',
      ]);

      const b = await fx.clinic('get', '/lab-catalog/services', B, B.admin);
      const rowB = b.body.data.data.find(
        (s: { id: string }) => s.id === service.id,
      );
      expect(rowB.price).toMatchObject({
        source: 'list',
        unitPricePaisa: 500_000,
      });
      expect(JSON.stringify(b.body)).not.toContain('450000');
    });

    it('feature off → 403', async () => {
      const res = await fx.clinic(
        'get',
        '/lab-catalog/services',
        fx.clinicOff,
        fx.clinicOff.admin,
      );
      expect(res.status).toBe(403);
    });
  });

  describe('mappings and price quote', () => {
    let crownTreatment: CatalogService;

    beforeAll(async () => {
      const repo = fx.dataSource.getRepository(CatalogService);
      crownTreatment = await repo.save(
        repo.create({
          organizationId: A.organizationId,
          name: 'Zirconia crown',
          code: 'ZRC',
          kind: ServiceKind.PROCEDURE,
          defaultPrice: 12_000,
        }),
      );
      await fx.dataSource.getRepository(ServicePrice).save({
        organizationId: A.organizationId,
        locationId: A.locationId,
        serviceId: crownTreatment.id,
        doctorId: null,
        price: 15_000.5,
      });
    });

    it('clinic admins map a treatment to a lab service; doctors cannot', async () => {
      const asDoctor = await fx.clinic(
        'post',
        '/lab-catalog/mappings',
        A,
        A.doctor,
        {
          clinicTreatmentId: crownTreatment.id,
          labServiceId: service.id,
        },
      );
      expect(asDoctor.status).toBe(403);

      const res = await fx.clinic('post', '/lab-catalog/mappings', A, A.admin, {
        clinicTreatmentId: crownTreatment.id,
        labServiceId: service.id,
      });
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        isDefault: true,
        isActive: true,
        clinicTreatment: {
          id: crownTreatment.id,
          defaultPricePaisa: 1_200_000,
        },
        labService: { id: service.id, lab: { id: lab.id } },
      });

      const other = await fx.dataSource.getRepository(CatalogService).save({
        organizationId: A.organizationId,
        name: 'Crown (other)',
        kind: ServiceKind.PROCEDURE,
        defaultPrice: 1,
      });
      const twice = await fx.clinic(
        'post',
        '/lab-catalog/mappings',
        A,
        A.admin,
        {
          clinicTreatmentId: other.id,
          labServiceId: service.id,
        },
      );
      expect(code(twice)).toBe('LAB_SERVICE_ALREADY_MAPPED');

      const crossTenant = await fx.clinic(
        'post',
        '/lab-catalog/mappings',
        B,
        B.admin,
        {
          clinicTreatmentId: crownTreatment.id,
          labServiceId: service.id,
        },
      );
      expect(code(crossTenant)).toBe('CLINIC_TREATMENT_NOT_FOUND');
    });

    it('quotes lab cost and patient price for an order line', async () => {
      const res = await fx.clinic(
        'get',
        `/lab-catalog/price-quote?labServiceId=${service.id}&optionIds=${option.id}&rush=true`,
        A,
        A.doctor,
      );
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        on: today,
        lab: {
          source: 'negotiated',
          basePaisa: 450_000,
          optionsPaisa: 120_000,
          rushPaisa: 100_000,
          unitPaisa: 670_000,
          currency: 'PKR',
        },
        patient: {
          clinicTreatmentId: crownTreatment.id,
          unitPricePaisa: 1_500_050,
          level: 'LOCATION',
        },
      });
    });

    it('resolves by date: a price change only affects days from its start', async () => {
      const change = await platform('post', svcUrl(`/${service.id}/prices`), {
        organizationId: A.organizationId,
        unitPricePaisa: 470_000,
        effectiveFrom: tomorrow,
      });
      expect(change.status).toBe(201);
      const quote = (on: string) =>
        fx.clinic(
          'get',
          `/lab-catalog/price-quote?labServiceId=${service.id}&on=${on}`,
          A,
          A.doctor,
        );
      expect((await quote(today)).body.data.lab.unitPaisa).toBe(450_000);
      expect((await quote(tomorrow)).body.data.lab.unitPaisa).toBe(470_000);
    });

    it('an invited (not active) lab cannot be ordered from', async () => {
      const res = await fx.clinic(
        'get',
        `/lab-catalog/price-quote?labServiceId=${service.id}`,
        B,
        B.admin,
      );
      expect(code(res)).toBe('LAB_NOT_LINKED');
    });
  });

  describe('order templates', () => {
    let mine: { id: string; version: number };

    it('a doctor saves a personal template with a partial form pre-fill', async () => {
      const res = await fx.clinic(
        'post',
        '/lab-catalog/order-templates',
        A,
        A.doctor,
        {
          name: 'My zirconia crown',
          items: [
            {
              labServiceId: service.id,
              optionIds: [option.id],
              answers: { material: 'zirconia_monolithic' },
            },
          ],
        },
      );
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        shared: false,
        lab: { id: lab.id },
        specialtyId: dental.id,
        canEdit: true,
        body: {
          schemaVersion: 1,
          items: [
            {
              labServiceId: service.id,
              optionIds: [option.id],
              quantity: 1,
              rush: false,
              formCode: 'CROWN',
              answers: { material: 'zirconia_monolithic' },
            },
          ],
        },
      });
      mine = res.body.data;
    });

    it('answers are checked against the service form', async () => {
      const res = await fx.clinic(
        'post',
        '/lab-catalog/order-templates',
        A,
        A.doctor,
        {
          name: 'Broken',
          items: [{ labServiceId: service.id, answers: { colour: 'red' } }],
        },
      );
      expect(code(res)).toBe('ORDER_TEMPLATE_INVALID');
      expect((res.body.error ?? res.body).issues[0]).toMatchObject({
        path: 'items[0].answers.colour',
        code: 'unknown_field',
      });
    });

    it('only clinic admins share templates; private ones stay private', async () => {
      const denied = await fx.clinic(
        'post',
        '/lab-catalog/order-templates',
        A,
        A.doctor,
        {
          name: 'Shared by doctor',
          shared: true,
          items: [{ labServiceId: service.id }],
        },
      );
      expect(code(denied)).toBe('ORDER_TEMPLATE_FORBIDDEN');

      const shared = await fx.clinic(
        'post',
        '/lab-catalog/order-templates',
        A,
        A.admin,
        {
          name: 'Clinic crown',
          shared: true,
          items: [{ labServiceId: service.id, quantity: 2 }],
        },
      );
      expect(shared.status).toBe(201);

      const doctorList = await fx.clinic(
        'get',
        '/lab-catalog/order-templates',
        A,
        A.doctor,
      );
      expect(
        doctorList.body.data.data.map((t: { name: string }) => t.name).sort(),
      ).toEqual(['Clinic crown', 'My zirconia crown']);
      const adminList = await fx.clinic(
        'get',
        '/lab-catalog/order-templates',
        A,
        A.admin,
      );
      expect(
        adminList.body.data.data.map((t: { name: string }) => t.name),
      ).toEqual(['Clinic crown']);
      const peek = await fx.clinic(
        'get',
        `/lab-catalog/order-templates/${mine.id}`,
        A,
        A.admin,
      );
      expect(code(peek)).toBe('ORDER_TEMPLATE_NOT_FOUND');

      const doctorEditsShared = await fx.clinic(
        'patch',
        `/lab-catalog/order-templates/${shared.body.data.id}`,
        A,
        A.doctor,
        { name: 'Hijack', version: 1 },
      );
      expect(code(doctorEditsShared)).toBe('ORDER_TEMPLATE_FORBIDDEN');

      const otherClinic = await fx.clinic(
        'get',
        '/lab-catalog/order-templates',
        B,
        B.admin,
      );
      expect(otherClinic.body.data.total).toBe(0);
    });

    it('counts uses and archives', async () => {
      const used = await fx.clinic(
        'post',
        `/lab-catalog/order-templates/${mine.id}/use`,
        A,
        A.doctor,
      );
      expect(used.body.data.useCount).toBe(1);
      const archived = await fx.clinic(
        'patch',
        `/lab-catalog/order-templates/${mine.id}`,
        A,
        A.doctor,
        { isActive: false, version: used.body.data.version },
      );
      expect(archived.body.data.isActive).toBe(false);
      const list = await fx.clinic(
        'get',
        '/lab-catalog/order-templates?scope=mine',
        A,
        A.doctor,
      );
      expect(list.body.data.total).toBe(0);
    });
  });
});
