import {
  NotificationAudience as A,
  NotificationChannel as C,
  OutboxStatus as S,
  defaultAudienceEnabled,
  defaultRuleEnabled,
} from '../notifications.enums';
import {
  decide,
  DecisionInput,
  isLockedRule,
  quietHoursEnd,
} from './notification-decision';

// 2026-10-19 15:00 in Karachi (UTC+5) = 10:00Z.
const AFTERNOON = new Date('2026-10-19T10:00:00Z');
// 2026-10-19 23:30 in Karachi = 18:30Z.
const NIGHT = new Date('2026-10-19T18:30:00Z');
const TZ = 'Asia/Karachi';
const OVERNIGHT = { start: '22:00:00', end: '08:00:00', timezone: TZ };

const base = (over: Partial<DecisionInput> = {}): DecisionInput => ({
  audience: A.PATIENT,
  channel: C.WHATSAPP,
  isMandatoryInternal: false,
  audienceEnabled: true,
  ruleEnabled: true,
  optedOut: false,
  quietHours: null,
  now: AFTERNOON,
  ...over,
});

describe('notification decision order (lab ERD §7)', () => {
  it('6. everything on → queued now', () => {
    expect(decide(base())).toEqual({
      status: S.QUEUED,
      scheduledFor: AFTERNOON,
      reason: 'enabled',
    });
  });

  it('1. mandatory internal in-app → queued even with every setting off', () => {
    const d = decide(
      base({
        audience: A.LAB,
        channel: C.IN_APP,
        isMandatoryInternal: true,
        audienceEnabled: false,
        ruleEnabled: false,
        quietHours: OVERNIGHT,
        now: NIGHT,
      }),
    );
    expect(d).toMatchObject({ status: S.QUEUED, reason: 'mandatory_internal' });
  });

  it('1. mandatory does not force external channels: they follow the settings', () => {
    const d = decide(
      base({
        audience: A.DOCTOR,
        channel: C.WHATSAPP,
        isMandatoryInternal: true,
        ruleEnabled: false,
      }),
    );
    expect(d).toMatchObject({
      status: S.SKIPPED_DISABLED,
      reason: 'rule_disabled',
    });
  });

  it('1. "mandatory internal" never applies to patients', () => {
    const d = decide(
      base({ isMandatoryInternal: true, audienceEnabled: false }),
    );
    expect(d).toMatchObject({
      status: S.SKIPPED_DISABLED,
      reason: 'audience_disabled',
    });
  });

  it('2. audience master switch off → skipped_disabled (before the rule is looked at)', () => {
    const d = decide(base({ audienceEnabled: false, ruleEnabled: true }));
    expect(d).toMatchObject({
      status: S.SKIPPED_DISABLED,
      reason: 'audience_disabled',
    });
  });

  it('3. rule off → skipped_disabled', () => {
    expect(decide(base({ ruleEnabled: false }))).toMatchObject({
      status: S.SKIPPED_DISABLED,
      reason: 'rule_disabled',
    });
  });

  it('2/3 win over opt-out and quiet hours (first match decides)', () => {
    expect(
      decide(
        base({
          ruleEnabled: false,
          optedOut: true,
          quietHours: OVERNIGHT,
          now: NIGHT,
        }),
      ).status,
    ).toBe(S.SKIPPED_DISABLED);
  });

  it('4. patient opted out → skipped_opt_out, even inside quiet hours', () => {
    expect(
      decide(base({ optedOut: true, quietHours: OVERNIGHT, now: NIGHT })),
    ).toMatchObject({ status: S.SKIPPED_OPT_OUT, reason: 'opted_out' });
  });

  it('5. inside quiet hours → held until they end', () => {
    const d = decide(base({ quietHours: OVERNIGHT, now: NIGHT }));
    expect(d.status).toBe(S.HELD_QUIET_HOURS);
    expect(d.reason).toBe('quiet_hours');
    // Next morning 08:00 Karachi = 03:00Z on the 20th.
    expect(d.scheduledFor.toISOString()).toBe('2026-10-20T03:00:00.000Z');
  });

  it('5. outside quiet hours → queued', () => {
    expect(decide(base({ quietHours: OVERNIGHT })).status).toBe(S.QUEUED);
  });

  it('5. in-app is never held by quiet hours', () => {
    const d = decide(
      base({
        audience: A.DOCTOR,
        channel: C.IN_APP,
        quietHours: OVERNIGHT,
        now: NIGHT,
      }),
    );
    expect(d.status).toBe(S.QUEUED);
  });

  it('§19: patient notifications OFF by default → skipped_disabled', () => {
    for (const channel of [C.WHATSAPP, C.SMS]) {
      expect(
        decide(
          base({
            channel,
            audienceEnabled: defaultAudienceEnabled(A.PATIENT),
            ruleEnabled: defaultRuleEnabled(A.PATIENT, channel),
          }),
        ).status,
      ).toBe(S.SKIPPED_DISABLED);
    }
  });

  it('defaults: internal audiences on, in-app only', () => {
    expect(defaultAudienceEnabled(A.DOCTOR)).toBe(true);
    expect(defaultRuleEnabled(A.DOCTOR, C.IN_APP)).toBe(true);
    expect(defaultRuleEnabled(A.DOCTOR, C.WHATSAPP)).toBe(false);
    expect(defaultRuleEnabled(A.PATIENT, C.WHATSAPP)).toBe(false);
  });

  it('only mandatory internal in-app rules are locked', () => {
    expect(isLockedRule(true, A.LAB, C.IN_APP)).toBe(true);
    expect(isLockedRule(true, A.LAB, C.EMAIL)).toBe(false);
    expect(isLockedRule(true, A.PATIENT, C.IN_APP)).toBe(false);
    expect(isLockedRule(false, A.LAB, C.IN_APP)).toBe(false);
  });
});

describe('quietHoursEnd', () => {
  const at = (hhmmKarachi: string, day = '2026-10-19') =>
    new Date(`${day}T${hhmmKarachi}:00+05:00`);

  it('overnight window: before midnight ends tomorrow, after midnight ends today', () => {
    expect(quietHoursEnd(at('22:00'), OVERNIGHT)?.toISOString()).toBe(
      '2026-10-20T03:00:00.000Z',
    );
    expect(quietHoursEnd(at('03:15'), OVERNIGHT)?.toISOString()).toBe(
      '2026-10-19T03:00:00.000Z',
    );
  });

  it('end is exclusive, start inclusive', () => {
    expect(quietHoursEnd(at('08:00'), OVERNIGHT)).toBeNull();
    expect(quietHoursEnd(at('21:59'), OVERNIGHT)).toBeNull();
  });

  it('same-day window', () => {
    const lunch = { start: '13:00', end: '14:30', timezone: TZ };
    expect(quietHoursEnd(at('13:45'), lunch)?.toISOString()).toBe(
      '2026-10-19T09:30:00.000Z',
    );
    expect(quietHoursEnd(at('14:30'), lunch)).toBeNull();
    expect(quietHoursEnd(at('12:59'), lunch)).toBeNull();
  });

  it('start == end means no window', () => {
    expect(
      quietHoursEnd(at('10:00'), {
        start: '10:00',
        end: '10:00',
        timezone: TZ,
      }),
    ).toBeNull();
  });
});
