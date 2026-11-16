import { NotFoundException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type { ClockService } from 'src/common/clock/clock.service';
import type { SettingsRegistryService } from 'src/settings-registry/settings-registry.service';
import type { PatientContext } from '../context/patient-context';
import type { PrescriptionPdfService } from 'src/prescriptions/services/prescription-pdf.service';
import { PatientAccessLogService } from './patient-access-log.service';
import { PatientClinicsService } from './patient-clinics.service';
import { PatientReadsService } from './patient-reads.service';

const UUID = '11111111-1111-4111-8111-111111111111';
const ORG_OK = 'org-ok';
const ORG_PENDING = 'org-pending';
const ORG_SUSPENDED = 'org-suspended';

const ctx: PatientContext = {
  accountId: 'acc-1',
  sessionId: 's-1',
  profiles: [
    { id: 'prof-1', relation: 'self', isSelf: true },
    { id: 'prof-2', relation: 'child', isSelf: false },
  ],
  links: [
    link('l1', 'prof-1', ORG_OK, 'pat-1'),
    link('l2', 'prof-2', ORG_PENDING, 'pat-2'),
    link('l3', 'prof-1', ORG_SUSPENDED, 'pat-3', 'frozen'),
  ],
};

function link(
  id: string,
  profileId: string,
  organizationId: string,
  patientId: string,
  status: 'active' | 'frozen' = 'active',
) {
  return {
    id,
    profileId,
    organizationId,
    patientId,
    status,
    patientAppEnabled: true,
  };
}

type Result = { many?: unknown[]; one?: unknown };

/** Chainable query-builder double that records every where / param. */
class FakeQb {
  table = '';
  wheres: string[] = [];
  params: Record<string, unknown> = {};
  expressionMap = { mainAlias: { name: 'x' } };
  constructor(private readonly results: Record<string, Result>) {}
  select = () => this;
  joins: string[] = [];
  innerJoin = (_t: string, _a: string, cond: string) => {
    this.joins.push(cond);
    return this;
  };
  leftJoin = () => this;
  orderBy = () => this;
  addOrderBy = () => this;
  groupBy = () => this;
  offset = () => this;
  limit = () => this;
  from = (table: string) => {
    this.table = table;
    return this;
  };
  andWhere = (sql: string, params?: Record<string, unknown>) => {
    this.wheres.push(sql);
    Object.assign(this.params, params);
    return this;
  };
  where = this.andWhere;
  getRawMany = () => Promise.resolve(this.results[this.table]?.many ?? []);
  getRawOne = () => Promise.resolve(this.results[this.table]?.one);
}

function build(results: Record<string, Result> = {}) {
  const qbs: FakeQb[] = [];
  const orgs = [
    org(ORG_OK, 'approved', true, 'Smile'),
    org(ORG_PENDING, 'pending', true, 'Fake'),
    org(ORG_SUSPENDED, 'approved', false, 'Old Clinic'),
  ];
  const dataSource = {
    createQueryBuilder: () => {
      const qb = new FakeQb(results);
      qbs.push(qb);
      return qb;
    },
    getRepository: () => ({ find: () => Promise.resolve(orgs) }),
  } as unknown as DataSource;
  const settings = {
    getMany: (_keys: string[], c: { organizationId: string }) =>
      Promise.resolve({
        'theme.logo_url': null,
        'theme.brand_color': '#112233',
        'patient_app.show_billing': c.organizationId !== ORG_SUSPENDED,
        'patient_app.show_diagnosis': c.organizationId !== ORG_SUSPENDED,
      }),
  } as unknown as SettingsRegistryService;
  const insert = jest.fn().mockResolvedValue(undefined);
  const accessLog = new PatientAccessLogService({
    insert,
  } as never);
  const today = jest.fn(() => '2026-11-15');
  const clock = {
    today,
    now: () => new Date('2026-11-15T10:00:00Z'),
  } as unknown as ClockService;
  const generatePdfBuffer = jest.fn().mockResolvedValue(Buffer.from('%PDF-1'));
  const pdfs = { generatePdfBuffer } as unknown as PrescriptionPdfService;
  const clinics = new PatientClinicsService(dataSource, settings);
  const service = new PatientReadsService(
    dataSource,
    clinics,
    accessLog,
    clock,
    pdfs,
  );
  return { service, qbs, insert, clinics, generatePdfBuffer, today };
}

function org(
  id: string,
  approvalStatus: string,
  isActive: boolean,
  name: string,
) {
  return {
    id,
    name,
    approvalStatus,
    isActive,
    currency: 'PKR',
    timezone: 'Asia/Karachi',
  };
}

const loc = {
  locationId: 'loc-1',
  locationName: 'Main',
  locationTimezone: 'Asia/Karachi',
  locationPhone: null,
  locationAddress: null,
};

describe('PatientClinicsService (A-19)', () => {
  it('drops never-approved clinics, flags suspended ones', async () => {
    const { clinics } = build();
    const scope = await clinics.visibleScope(ctx);
    expect([...scope.clinics.keys()].sort()).toEqual(
      [ORG_OK, ORG_SUSPENDED].sort(),
    );
    expect(scope.clinics.get(ORG_OK)?.ref.clinicStatus).toBe('active');
    expect(scope.clinics.get(ORG_SUSPENDED)?.ref.clinicStatus).toBe(
      'suspended',
    );
    expect(scope.ctx.links.map((l) => l.organizationId).sort()).toEqual(
      [ORG_OK, ORG_SUSPENDED].sort(),
    );
  });

  it('narrow() keeps only clinics passing the capability', async () => {
    const { clinics } = build();
    const scope = await clinics.visibleScope(ctx);
    const billing = clinics.narrow(scope, (c) => c.showBilling);
    expect([...billing.clinics.keys()]).toEqual([ORG_OK]);
    expect(billing.ctx.links).toHaveLength(1);
  });

  it('no links → nothing, no queries', async () => {
    const { clinics } = build();
    const scope = await clinics.visibleScope({ ...ctx, links: [] });
    expect(scope.clinics.size).toBe(0);
  });
});

describe('PatientReadsService', () => {
  describe('scoping', () => {
    it('appointments are filtered by linked (org, patient) pairs of visible clinics only', async () => {
      const { service, qbs } = build();
      await service.appointments(ctx, {});
      const qb = qbs[0];
      const where = qb.wheres.join(' ');
      expect(where).toMatch(/\("a"\."organization_id", "a"\."patient_id"\) IN/);
      const values = Object.values(qb.params);
      expect(values).toEqual(
        expect.arrayContaining([ORG_OK, 'pat-1', ORG_SUSPENDED, 'pat-3']),
      );
      // the pending clinic's patient never reaches the query
      expect(values).not.toContain(ORG_PENDING);
      expect(values).not.toContain('pat-2');
    });

    it('a foreign profileId → 404 before any query', async () => {
      const { service, qbs } = build();
      await expect(
        service.appointments(ctx, { profileId: UUID }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(qbs).toHaveLength(0);
    });

    it('a profile whose only clinic is unapproved matches nothing', async () => {
      const { service, qbs } = build();
      await service.visits(ctx, { profileId: 'prof-2' });
      expect(qbs.every((q) => q.wheres.includes('1 = 0'))).toBe(true);
    });

    it('prescriptions require finalized/amended + signed', async () => {
      const { service, qbs } = build();
      await service.prescriptions(ctx, {});
      const qb = qbs[0];
      expect(qb.params.visibleStatuses).toEqual(['FINALIZED', 'AMENDED']);
      expect(qb.wheres).toContain('p.signed_at IS NOT NULL');
    });
  });

  describe('prescription detail', () => {
    it('non-uuid id → 404', async () => {
      const { service } = build();
      await expect(service.prescription(ctx, 'abc')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('not found within scope → 404 (no log)', async () => {
      const { service, insert } = build();
      await expect(service.prescription(ctx, UUID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(insert).not.toHaveBeenCalled();
    });

    it('found → DTO with medicines, one view_detail log row', async () => {
      const { service, insert } = build({
        prescriptions: {
          one: {
            ...loc,
            id: UUID,
            organizationId: ORG_OK,
            patientId: 'pat-1',
            number: 'RX-1',
            signedAt: '2026-11-10T08:00:00Z',
            pdfUrl: null,
            medicinesCount: '1',
            doctorName: 'Dr A',
          },
        },
        prescription_medicines: {
          many: [
            {
              medicineName: 'Paracetamol',
              medicineNameUrdu: null,
              type: 'TABLET',
              dosage: '500mg',
              frequency: 'BD',
              frequencyTiming: null,
              mealRelation: 'NONE',
              duration: '3 days',
              specialInstructions: null,
              specialInstructionsUrdu: null,
            },
          ],
        },
      });
      const dto = await service.prescription(ctx, UUID);
      expect(dto.profileId).toBe('prof-1');
      expect(dto.medicines[0].frequencyTiming).toEqual([]);
      expect(dto.hasPdf).toBe(true);
      expect(dto).not.toHaveProperty('pdfUrl');
      expect(insert).toHaveBeenCalledWith([
        {
          profileId: 'prof-1',
          organizationId: ORG_OK,
          patientId: 'pat-1',
          action: 'view_detail',
          resourceType: 'prescription',
          resourceId: UUID,
          accountId: 'acc-1',
        },
      ]);
    });

    it('a prescription of an unapproved clinic is not found', async () => {
      const { service } = build({
        prescriptions: {
          one: {
            ...loc,
            id: UUID,
            organizationId: ORG_PENDING,
            patientId: 'pat-2',
            number: 'RX-9',
            signedAt: '2026-11-10T08:00:00Z',
            pdfUrl: null,
            medicinesCount: '0',
            doctorName: null,
          },
        },
      });
      await expect(service.prescription(ctx, UUID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('visits: diagnosis setting per clinic', () => {
    it('list is mapped with the clinic flag and logged once per patient', async () => {
      const row = (id: string, org: string, patient: string) => ({
        ...loc,
        id,
        organizationId: org,
        patientId: patient,
        visitDate: '2026-11-10',
        followUpDate: null,
        diagnosis: 'Caries',
        treatments: ['Filling'],
        doctorName: 'Dr A',
      });
      const { service, insert } = build({
        patient_encounters: {
          one: { n: '2' },
          many: [row('v1', ORG_OK, 'pat-1'), row('v2', ORG_OK, 'pat-1')],
        },
      });
      const page = await service.visits(ctx, {});
      expect(page.total).toBe(2);
      expect(page.totalPages).toBe(1);
      expect(page.data[0].diagnosis).toBe('Caries');
      const logged = insert.mock.calls[0][0] as unknown[];
      expect(logged).toHaveLength(1);
    });
  });

  describe('billing', () => {
    it('only clinics with show_billing; totals in minor units', async () => {
      const { service, qbs } = build({
        invoices: {
          many: [],
        },
      });
      const out = await service.billingSummary(ctx, {});
      expect(out).toEqual([]); // no invoices rows → no totals rows
      const values = qbs.flatMap((q) => Object.values(q.params));
      expect(values).toContain(ORG_OK);
      expect(values).not.toContain(ORG_SUSPENDED); // show_billing off there
      expect(values).not.toContain(ORG_PENDING);
    });

    it('returns per-clinic summary', async () => {
      const { service } = build({
        invoices: {
          one: { n: '1', total: '100.00', paid: '40.00', balance: '60.00' },
          many: [
            {
              locationTimezone: 'Asia/Karachi',
              organizationId: ORG_OK,
              patientId: 'pat-1',
              id: 'i1',
              invoiceNumber: 'INV-1',
              issuedAt: '2026-11-01T00:00:00Z',
              dueDate: '2026-11-30',
              totalAmount: '100.00',
              paidAmount: '40.00',
              balanceDue: '60.00',
            },
          ],
        },
      });
      const out = await service.billingSummary(ctx, {});
      expect(out).toHaveLength(1);
      expect(out[0]).toMatchObject({
        currency: 'PKR',
        billedMinor: 10000,
        paidMinor: 4000,
        balanceMinor: 6000,
      });
      expect(out[0].invoices[0].status).toBe('partial');
      expect(out[0].clinic.clinicStatus).toBe('active');
    });
  });

  describe('rework 1', () => {
    it('visits are only completed consultations (queue entry completed)', async () => {
      const { service, qbs } = build({
        patient_encounters: { one: { n: '0' }, many: [] },
      });
      await service.visits(ctx, {});
      expect(
        qbs.every((q) =>
          q.joins.some((j) => j.includes("qe.status = 'completed'")),
        ),
      ).toBe(true);
    });

    const rxRow = (org: string, patient: string) => ({
      ...loc,
      id: UUID,
      organizationId: org,
      patientId: patient,
      number: 'RX/9',
      signedAt: '2026-11-10T08:00:00Z',
      medicinesCount: '0',
      doctorName: null,
    });

    it('pdf: streams a rendered buffer, logs a download, no URL involved', async () => {
      const { service, insert, generatePdfBuffer } = build({
        prescriptions: { one: rxRow(ORG_OK, 'pat-1') },
      });
      const out = await service.prescriptionPdf(ctx, UUID);
      expect(out.buffer.toString()).toBe('%PDF-1');
      expect(out.fileName).toBe('prescription-RX9.pdf');
      expect(generatePdfBuffer).toHaveBeenCalledWith(UUID, ORG_OK);
      expect(insert.mock.calls[0][0][0]).toMatchObject({
        action: 'download',
        resourceType: 'prescription',
        resourceId: UUID,
      });
    });

    it('pdf: 404 when the clinic has show_diagnosis off; detail has hasPdf false', async () => {
      const { service, generatePdfBuffer } = build({
        prescriptions: { one: rxRow(ORG_SUSPENDED, 'pat-3') },
        prescription_medicines: { many: [] },
      });
      await expect(service.prescriptionPdf(ctx, UUID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(generatePdfBuffer).not.toHaveBeenCalled();
      const detail = await service.prescription(ctx, UUID);
      expect(detail.hasPdf).toBe(false);
    });

    it('pdf: 404 for an id outside the scope or malformed', async () => {
      const { service } = build();
      await expect(service.prescriptionPdf(ctx, UUID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.prescriptionPdf(ctx, 'x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('a profileId filter labels rows with that profile directly', async () => {
      const shared: PatientContext = {
        ...ctx,
        links: [
          link('l1', 'prof-1', ORG_OK, 'pat-1'),
          link('l4', 'prof-2', ORG_OK, 'pat-1'),
        ],
      };
      const row = {
        ...loc,
        id: 'a1',
        organizationId: ORG_OK,
        patientId: 'pat-1',
        startTime: '2026-12-01T09:00:00Z',
        endTime: '2026-12-01T09:30:00Z',
        status: 'scheduled',
        type: 'consultation',
        doctorName: null,
      };
      const { service } = build({ appointments: { many: [row] } });
      const filtered = await service.appointments(shared, {
        profileId: 'prof-2',
      });
      expect(filtered[0].profileId).toBe('prof-2');
    });

    it('canConfirm: only future scheduled rows of active links', async () => {
      const mk = (id: string, status: string, startTime: string) => ({
        ...loc,
        id,
        organizationId: ORG_OK,
        patientId: 'pat-1',
        startTime,
        endTime: startTime,
        status,
        type: 'consultation',
        doctorName: null,
        patientConfirmedAt: null,
      });
      const { service } = build({
        appointments: {
          many: [
            mk('a1', 'scheduled', '2026-12-01T09:00:00Z'),
            mk('a2', 'cancelled', '2026-12-01T09:00:00Z'),
            mk('a3', 'scheduled', '2026-11-01T09:00:00Z'),
          ],
        },
      });
      const out = await service.appointments(ctx, {});
      expect(out.map((o) => o.canConfirm)).toEqual([true, false, false]);
    });

    it('overdue uses the invoice location clock', async () => {
      const { service, today } = build({
        invoices: {
          one: { n: '1', total: '10.00', paid: '0.00', balance: '10.00' },
          many: [
            {
              locationTimezone: 'Pacific/Kiritimati',
              organizationId: ORG_OK,
              patientId: 'pat-1',
              id: 'i1',
              invoiceNumber: 'INV-1',
              issuedAt: '2026-11-01T00:00:00Z',
              dueDate: '2026-11-14',
              totalAmount: '10.00',
              paidAmount: '0.00',
              balanceDue: '10.00',
            },
          ],
        },
      });
      const out = await service.billingSummary(ctx, {});
      expect(today).toHaveBeenCalledWith('Pacific/Kiritimati');
      expect(out[0].invoices[0].status).toBe('overdue');
    });
  });

  describe('access log failures never break a read', () => {
    it('swallows insert errors', async () => {
      const { service, insert } = build({
        patient_encounters: { one: { n: '1' }, many: [] },
      });
      insert.mockRejectedValue(new Error('db down'));
      await expect(service.visits(ctx, {})).resolves.toBeDefined();
    });
  });
});
