import { ClaimEligibilityService } from './claim-eligibility.service';
import { publishPatientLinkEvent } from './patient-link-events';

describe('ClaimEligibilityService.assertOk (A-19)', () => {
  const codeOf = (fn: () => void): { status: number; code: string } | null => {
    try {
      fn();
      return null;
    } catch (e) {
      const err = e as {
        getStatus: () => number;
        getResponse: () => { code: string };
      };
      return { status: err.getStatus(), code: err.getResponse().code };
    }
  };

  it('passes for an eligible clinic', () => {
    expect(
      codeOf(() => ClaimEligibilityService.assertOk('ok', true)),
    ).toBeNull();
  });

  it('a never-approved clinic reads as an invalid token for patients, a clear 403 for staff', () => {
    expect(
      codeOf(() => ClaimEligibilityService.assertOk('unapproved', true)),
    ).toEqual({ status: 404, code: 'CLAIM_INVALID' });
    expect(
      codeOf(() => ClaimEligibilityService.assertOk('unapproved', false)),
    ).toEqual({ status: 403, code: 'CLINIC_NOT_APPROVED' });
  });

  it('suspended and app-disabled are 403 with their own codes', () => {
    expect(
      codeOf(() => ClaimEligibilityService.assertOk('suspended', true)),
    ).toEqual({ status: 403, code: 'CLINIC_SUSPENDED' });
    expect(
      codeOf(() => ClaimEligibilityService.assertOk('app_disabled', true)),
    ).toEqual({ status: 403, code: 'PATIENT_APP_DISABLED' });
  });
});

describe('publishPatientLinkEvent', () => {
  it('writes an ids-only outbox row for the patient room', async () => {
    const query = jest.fn().mockResolvedValue([]);
    await publishPatientLinkEvent({ query } as never, {
      code: 'patient.record_linked',
      organizationId: 'org-1',
      accountId: 'acc-1',
      linkId: 'link-1',
    });
    const [sql, params] = query.mock.calls[0] as [string, string[]];
    expect(sql).toContain('INSERT INTO outbox');
    expect(params[0]).toBe('org-1');
    expect(params[1]).toBe('patient:acc-1');
    expect(JSON.parse(params[2])).toEqual({
      type: 'feed.changed',
      kinds: ['links'],
      event: 'patient.record_linked',
      linkId: 'link-1',
    });
  });
});
