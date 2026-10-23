import { ConflictException } from '@nestjs/common';
import type { ActorRef } from 'src/common/audit/audit.enums';
import type { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { PatientImportService } from './patient-import.service';

const ctx = { organizationId: 'org-1', locationId: 'loc-1' } as TenantContext;
const actor = { userId: 'user-1' } as unknown as ActorRef;

function setup(existing: { phone: string; cnic: string | null }[] = []) {
  let n = existing.length;
  const create = jest.fn(
    (_ctx: unknown, dto: { fullName: string; phone: string }) => {
      if (dto.phone === '03009999999') {
        return Promise.reject(
          new ConflictException(
            'A patient with this phone number already exists in this organization',
          ),
        );
      }
      n += 1;
      return Promise.resolve({
        id: `p-${n}`,
        patientNumber: `P-${String(n).padStart(5, '0')}`,
        fullName: dto.fullName,
      });
    },
  );
  const service = new PatientImportService(
    {
      find: jest.fn().mockResolvedValue(
        existing.map((e, i) => ({
          ...e,
          patientNumber: `P-0000${i + 1}`,
          fullName: `Old ${i + 1}`,
        })),
      ),
    } as never,
    { create } as never,
    {
      timezoneFor: jest.fn().mockResolvedValue('Asia/Karachi'),
      today: () => '2026-10-24',
    } as never,
    { info: jest.fn() } as never,
  );
  return { service, create };
}

describe('PatientImportService', () => {
  const rows = [
    { fullName: 'Ali', phone: '0300-1234567' }, // duplicate of existing (other format)
    { fullName: 'Sara', phone: '03211111111', cnic: '4210112345671' },
    { fullName: '', phone: '03212222222' }, // error: no name
    { fullName: 'Sara again', phone: '+92 321 1111111' }, // repeats row 2
    { fullName: 'Bilal', phone: '03213333333', cnic: '42101-1234567-1' }, // repeats row 2's CNIC
  ];

  it('dry run: classifies rows and creates nothing', async () => {
    const { service, create } = setup([{ phone: '+923001234567', cnic: null }]);
    const res = await service.import(
      ctx,
      { rows, dryRun: true, duplicateStrategy: 'skip' },
      actor,
    );
    expect(res.rows.map((r) => r.status)).toEqual([
      'duplicate',
      'would_create',
      'error',
      'duplicate',
      'duplicate',
    ]);
    expect(res.rows[0].errors?.[0]).toContain('P-00001');
    expect(res.rows[3].errors?.[0]).toContain('row 2 of this file');
    expect(res.totals).toMatchObject({
      total: 5,
      wouldCreate: 1,
      duplicates: 3,
      errors: 1,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("'create' still refuses shared phones but creates same-CNIC rows", async () => {
    const { service, create } = setup([{ phone: '+923001234567', cnic: null }]);
    const res = await service.import(
      ctx,
      { rows, dryRun: false, duplicateStrategy: 'create', offset: 10 },
      actor,
    );
    expect(res.rows.map((r) => [r.index, r.status])).toEqual([
      [10, 'error'],
      [11, 'created'],
      [12, 'error'],
      [13, 'error'],
      [14, 'created'],
    ]);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][1]).toMatchObject({
      fullName: 'Sara',
      phone: '03211111111',
      cnic: '42101-1234567-1',
      tags: ['imported'],
    });
  });

  it('a failing create is reported on its row only', async () => {
    const { service } = setup();
    const res = await service.import(
      ctx,
      {
        rows: [
          { fullName: 'A', phone: '03009999999' },
          { fullName: 'B', phone: '03001111111' },
        ],
        dryRun: false,
        duplicateStrategy: 'skip',
      },
      actor,
    );
    expect(res.rows[0]).toMatchObject({
      status: 'error',
      errors: [
        'A patient with this phone number already exists in this organization',
      ],
    });
    expect(res.rows[1]).toMatchObject({
      status: 'created',
      patientNumber: 'P-00001',
    });
  });

  it('caps real imports at 1000 rows per request', async () => {
    const { service } = setup();
    const many = Array.from({ length: 1001 }, (_, i) => ({
      fullName: `P${i}`,
      phone: `0300${String(i).padStart(7, '0')}`,
    }));
    await expect(
      service.import(
        ctx,
        { rows: many, dryRun: false, duplicateStrategy: 'skip' },
        actor,
      ),
    ).rejects.toThrow('at most 1000');
  });
});
