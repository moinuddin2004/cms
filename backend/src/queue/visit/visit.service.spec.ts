import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ClockService } from 'src/common/clock/clock.service';
import { QueuePositionService } from '../services/queue-position.service';
import { VisitService } from './visit.service';
import { generateVisitToken, hashVisitToken } from './visit-token';

const ORG = 'org-1';
const LOC = 'loc-1';
const ENTRY = 'entry-1';

describe('visit tokens', () => {
  it('are random, 43 url-safe chars, hashed with sha256', () => {
    const a = generateVisitToken();
    const b = generateVisitToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
    expect(hashVisitToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashVisitToken(a)).not.toContain(a);
  });
});

describe('VisitService', () => {
  const now = new Date('2026-11-15T10:00:00.000Z');
  let query: jest.Mock;
  let findEntry: jest.Mock;
  let findSession: jest.Mock;
  let positions: jest.Mock;
  let service: VisitService;

  beforeEach(() => {
    query = jest.fn().mockResolvedValue([]);
    findEntry = jest.fn();
    findSession = jest.fn();
    positions = jest.fn();
    const dataSource = {
      query,
      getRepository: (e: { name: string }) => ({
        findOne: e.name === 'QueueEntry' ? findEntry : findSession,
      }),
    } as unknown as DataSource;
    service = new VisitService(
      dataSource,
      { positions } as unknown as QueuePositionService,
      { now: () => now } as unknown as ClockService,
      { get: () => 'https://app.example.com/' } as unknown as ConfigService,
    );
  });

  describe('createLink', () => {
    it('stores only the hash, expires after 12 h, returns the raw token once in the url', async () => {
      findEntry.mockResolvedValue({ id: ENTRY, queueSessionId: 's1' });
      findSession.mockResolvedValue({ id: 's1', locationId: LOC });

      const out = await service.createLink(ORG, LOC, ENTRY);

      const token = out.url.replace('https://app.example.com/v/', '');
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(out.expiresAt).toBe('2026-11-15T22:00:00.000Z');
      const insert = query.mock.calls.find((c) =>
        String(c[0]).includes('INSERT INTO queue_visit_tokens'),
      )!;
      expect(insert[1][2]).toBe(hashVisitToken(token));
      expect(JSON.stringify(insert[1])).not.toContain(token);
    });

    it('replaces the earlier link of the same entry (one live link per entry)', async () => {
      findEntry.mockResolvedValue({ id: ENTRY, queueSessionId: 's1' });
      findSession.mockResolvedValue({ id: 's1', locationId: LOC });
      await service.createLink(ORG, LOC, ENTRY);
      const sqls = query.mock.calls.map((c) => String(c[0]));
      const del = sqls.findIndex((q) => q.includes('DELETE FROM queue_visit_tokens WHERE entry_id'));
      const ins = sqls.findIndex((q) => q.includes('INSERT INTO queue_visit_tokens'));
      expect(del).toBeGreaterThanOrEqual(0);
      expect(del).toBeLessThan(ins);
    });

    it('404s an entry of another location or organization', async () => {
      findEntry.mockResolvedValue({ id: ENTRY, queueSessionId: 's1' });
      findSession.mockResolvedValue({ id: 's1', locationId: 'other-loc' });
      await expect(service.createLink(ORG, LOC, ENTRY)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      findEntry.mockResolvedValue(null);
      await expect(service.createLink(ORG, LOC, ENTRY)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('state', () => {
    const token = generateVisitToken();

    it('returns only the contract fields — no names, no ids', async () => {
      query
        .mockResolvedValueOnce([{ entry_id: ENTRY }])
        .mockResolvedValueOnce([{ clinic: 'Smile Clinic', location: 'Main' }]);
      positions.mockResolvedValue([
        {
          entryId: ENTRY,
          organizationId: ORG,
          locationId: LOC,
          patientId: 'patient-1',
          sessionId: 's1',
          serviceDate: '2026-11-15',
          token: 'A-012',
          status: 'waiting',
          doctorName: 'Dr Secret',
          peopleAhead: 3,
          nowServingToken: 'A-009',
          seq: 4,
        },
      ]);

      const state = await service.state(token);

      expect(state).toEqual({
        clinicName: 'Smile Clinic',
        locationName: 'Main',
        token: 'A-012',
        status: 'waiting',
        peopleAhead: 3,
        nowServingToken: 'A-009',
        updatedAt: now.toISOString(),
      });
      expect(JSON.stringify(state)).not.toMatch(/Dr Secret|patient-1/);
      // looked up by hash, expiry and approved clinic enforced in SQL
      const [sql, params] = query.mock.calls[0];
      expect(params).toEqual([hashVisitToken(token), 30]);
      expect(sql).toContain('expires_at > now()');
      // the link ends 30 min after the entry does (audit L10)
      expect(sql).toContain("e.status IN ('waiting', 'called', 'in_consultation', 'on_hold', 'skipped')");
      expect(sql).toContain('e.finished_at > now() - make_interval(mins => $2)');
      expect(sql).toContain("approval_status = 'approved'");
    });

    it('one generic 404 for malformed, unknown and expired tokens', async () => {
      await expect(service.state('short')).rejects.toBeInstanceOf(NotFoundException);
      expect(query).not.toHaveBeenCalled();
      query.mockResolvedValueOnce([]); // unknown / expired
      await expect(service.state(token)).rejects.toMatchObject({
        response: { code: 'NOT_FOUND' },
      });
    });
  });
});
