import type { AccessContext } from 'src/access/access-context';
import type { Permission } from 'src/access/catalog/permissions';
import { ActorSide } from 'src/common/audit/audit.enums';
import type { TimelineEntry } from 'src/common/audit/audit.service';
import { PATIENT_AUDIT_ENTITY, redactPatientTimeline } from './patient-audit';

const reader = (...perms: Permission[]) =>
  ({ can: (p: Permission) => perms.includes(p) }) as unknown as AccessContext;

function entry(
  entityType: string,
  after: Record<string, unknown>,
  before: Record<string, unknown> | null = null,
): TimelineEntry {
  return {
    id: entityType,
    kind: 'audit',
    entityType,
    entityId: 'e1',
    action: before ? 'update' : 'create',
    fromState: null,
    toState: null,
    changes: { before, after },
    reason: null,
    actorSide: ActorSide.CLINIC,
    via: null,
    actor: { id: 'u1', name: 'Reception' },
    createdAt: new Date('2026-10-23T09:00:00Z'),
  };
}

describe('redactPatientTimeline', () => {
  const entries = [
    entry(
      PATIENT_AUDIT_ENTITY.PATIENT,
      { phone: '0301', allergies: 'Penicillin' },
      { phone: '0300', allergies: null },
    ),
    entry(PATIENT_AUDIT_ENTITY.VITALS, { bpSystolic: 140 }),
    entry(PATIENT_AUDIT_ENTITY.DOCUMENT, { fileName: 'opg.png' }),
    entry(PATIENT_AUDIT_ENTITY.RECALL, { recallType: 'cleaning' }),
  ];

  it('shows everything to a reader with clinical and document access', () => {
    const out = redactPatientTimeline(
      entries,
      reader('patients.clinical.view', 'patients.documents.manage'),
    );
    expect(out).toEqual(entries);
  });

  it('keeps every event but hides values the reader may not open', () => {
    const out = redactPatientTimeline(entries, reader());
    expect(out.map((e) => e.entityType)).toEqual(
      entries.map((e) => e.entityType),
    );
    expect(out[0].changes).toEqual({
      before: { phone: '0300' },
      after: { phone: '0301' },
    });
    expect(out[1].changes).toBeNull();
    expect(out[2].changes).toBeNull();
    expect(out[3].changes).toEqual(entries[3].changes);
  });

  it('does not mutate the entries it was given', () => {
    redactPatientTimeline(entries, reader());
    expect(entries[0].changes?.after).toHaveProperty('allergies');
  });
});
