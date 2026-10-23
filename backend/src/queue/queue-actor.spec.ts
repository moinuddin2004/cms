import { AccessContext } from 'src/access/access-context';
import {
  expandImplies,
  normalizeGrants,
  PermissionMap,
} from 'src/access/catalog/permissions';
import type { QueueSession } from './entities/queue-session.entity';
import { QueueOrchestrator } from './services/queue-orchestrator.service';
import {
  canHandleEntry,
  canOpenSession,
  canRunSession,
  QueueActor,
  queueActorFrom,
  SYSTEM_ACTOR,
} from './queue-actor';

const OWN_DOC = 'doc-own';
const OTHER_DOC = 'doc-other';

function access(
  grants: Record<string, unknown>,
  over: { employeeId?: string | null; isOwner?: boolean } = {},
) {
  const permissions: PermissionMap = expandImplies(normalizeGrants(grants));
  return new AccessContext({
    userId: 'u1',
    organizationId: 'org1',
    locationId: 'loc1',
    version: 1,
    isSuperAdmin: false,
    isOwner: over.isOwner ?? false,
    isMember: true,
    employeeId: over.employeeId === undefined ? OWN_DOC : over.employeeId,
    features: ['appointments.core'],
    permissions,
    roles: [{ id: 'r1', name: 'Doctor', templateKey: 'doctor' }],
    homeRoute: null,
  });
}

const actor = (
  grants: Record<string, unknown>,
  over?: Parameters<typeof access>[1],
) => queueActorFrom(access(grants, over));

const doctor = actor({ 'queue.doctor.own': true });
const anyDoctor = actor({ 'queue.doctor.any': true }, { employeeId: null });
const reception = actor(
  { 'queue.checkin': true, 'queue.entry.manage': true },
  { employeeId: 'emp-desk' },
);
const prioritizer = actor(
  { 'queue.entry.reprioritize': true },
  { employeeId: 'emp-lead' },
);
const nobody = actor({}, { employeeId: 'emp-x' });

describe('queueActorFrom', () => {
  it('maps the queue permissions, with implies expanded', () => {
    expect(anyDoctor).toMatchObject({
      anyDoctor: true,
      ownDoctor: true, // queue.doctor.any implies queue.doctor.own
      checkIn: false,
      manageEntries: false,
      reprioritize: false,
    });
    expect(reception).toMatchObject({
      checkIn: true,
      manageEntries: true,
      anyDoctor: false,
      ownDoctor: false,
    });
  });

  it('labels the audit row with role templates (or owner)', () => {
    expect(doctor.label).toBe('doctor');
    expect(actor({}, { isOwner: true }).label).toBe('owner');
  });
});

describe('queue permission rules', () => {
  it('own doctor runs only their own session', () => {
    expect(canRunSession(doctor, OWN_DOC)).toBe(true);
    expect(canRunSession(doctor, OTHER_DOC)).toBe(false);
  });

  it('queue.doctor.own without an employee id runs nothing', () => {
    const noEmployee = actor(
      { 'queue.doctor.own': true },
      { employeeId: null },
    );
    expect(canRunSession(noEmployee, OWN_DOC)).toBe(false);
  });

  it('queue.doctor.any runs every session', () => {
    expect(canRunSession(anyDoctor, OWN_DOC)).toBe(true);
    expect(canRunSession(anyDoctor, OTHER_DOC)).toBe(true);
  });

  it('reception cannot run a doctor session', () => {
    expect(canRunSession(reception, OTHER_DOC)).toBe(false);
  });

  it('skip / transfer: entry managers anywhere, doctors in their own session', () => {
    expect(canHandleEntry(reception, OTHER_DOC)).toBe(true);
    expect(canHandleEntry(doctor, OWN_DOC)).toBe(true);
    expect(canHandleEntry(doctor, OTHER_DOC)).toBe(false);
    expect(canHandleEntry(nobody, OWN_DOC)).toBe(false);
  });

  it('opening a session: check-in staff for anyone, a doctor for their own', () => {
    expect(canOpenSession(reception, OTHER_DOC)).toBe(true);
    expect(canOpenSession(doctor, OWN_DOC)).toBe(true);
    expect(canOpenSession(doctor, OTHER_DOC)).toBe(false);
    expect(canOpenSession(anyDoctor, OTHER_DOC)).toBe(true);
  });

  it('the system actor passes every rule', () => {
    expect(canRunSession(SYSTEM_ACTOR, OTHER_DOC)).toBe(true);
    expect(canHandleEntry(SYSTEM_ACTOR, OTHER_DOC)).toBe(true);
  });
});

/** The orchestrator's own asserts (they run inside each mutation). */
describe('QueueOrchestrator permission asserts', () => {
  const orchestrator = Object.create(
    QueueOrchestrator.prototype,
  ) as QueueOrchestrator;
  const asserts = orchestrator as unknown as {
    assertSessionDoctor(a: QueueActor, s: QueueSession): void;
    assertAnyDoctor(a: QueueActor): void;
    assertHandleEntry(a: QueueActor, s: QueueSession): void;
    assertManageEntries(a: QueueActor): void;
    assertReprioritize(a: QueueActor): void;
  };
  const session = (doctorId: string) => ({ doctorId }) as QueueSession;
  const forbidden = expect.objectContaining({ status: 403 });

  it('doctor actions: own session with queue.doctor.own, any with queue.doctor.any', () => {
    expect(() =>
      asserts.assertSessionDoctor(doctor, session(OWN_DOC)),
    ).not.toThrow();
    expect(() =>
      asserts.assertSessionDoctor(doctor, session(OTHER_DOC)),
    ).toThrow(forbidden);
    expect(() =>
      asserts.assertSessionDoctor(anyDoctor, session(OTHER_DOC)),
    ).not.toThrow();
    expect(() =>
      asserts.assertSessionDoctor(reception, session(OTHER_DOC)),
    ).toThrow(forbidden);
  });

  it('force complete needs queue.doctor.any', () => {
    expect(() => asserts.assertAnyDoctor(anyDoctor)).not.toThrow();
    expect(() => asserts.assertAnyDoctor(doctor)).toThrow(forbidden);
  });

  it('skip: queue.entry.manage anywhere, or the session doctor', () => {
    expect(() =>
      asserts.assertHandleEntry(reception, session(OTHER_DOC)),
    ).not.toThrow();
    expect(() =>
      asserts.assertHandleEntry(doctor, session(OWN_DOC)),
    ).not.toThrow();
    expect(() => asserts.assertHandleEntry(doctor, session(OTHER_DOC))).toThrow(
      forbidden,
    );
  });

  it('rejoin / remove need queue.entry.manage', () => {
    expect(() => asserts.assertManageEntries(reception)).not.toThrow();
    expect(() => asserts.assertManageEntries(doctor)).toThrow(forbidden);
    expect(() => asserts.assertManageEntries(anyDoctor)).toThrow(forbidden);
  });

  it('priority changes need queue.entry.reprioritize', () => {
    expect(() => asserts.assertReprioritize(prioritizer)).not.toThrow();
    expect(() => asserts.assertReprioritize(reception)).toThrow(forbidden);
  });

  it("ensureTodaySession refuses another doctor's session before any DB work", async () => {
    await expect(
      orchestrator.ensureTodaySession(
        { organizationId: 'org1', locationId: 'loc1' } as never,
        doctor,
        OTHER_DOC,
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
});
