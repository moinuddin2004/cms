import { ActorSide } from 'src/common/audit/audit.enums';
import { LabException } from '../common/lab-errors';
import { LabLinkStatus as S } from '../enums/lab.enums';
import {
  canLiftSuspension,
  LabLinkAction,
  resolveLinkTransition,
} from './lab-link-transitions';

const code = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (e) {
    return e instanceof LabException ? e.code : 'OTHER';
  }
  return undefined;
};

describe('lab link transitions', () => {
  it.each<[S, LabLinkAction, S]>([
    [S.INVITED, 'activate', S.ACTIVE],
    [S.INVITED, 'suspend', S.SUSPENDED],
    [S.ACTIVE, 'suspend', S.SUSPENDED],
    [S.SUSPENDED, 'reactivate', S.ACTIVE],
  ])('%s --%s--> %s', (from, action, to) => {
    expect(resolveLinkTransition(from, action, ActorSide.CLINIC, 'why')).toBe(
      to,
    );
  });

  it.each<[S, LabLinkAction]>([
    [S.ACTIVE, 'activate'],
    [S.SUSPENDED, 'activate'],
    [S.SUSPENDED, 'suspend'],
    [S.INVITED, 'reactivate'],
    [S.ACTIVE, 'reactivate'],
  ])('rejects %s --%s--> with INVALID_TRANSITION', (from, action) => {
    expect(
      code(() => resolveLinkTransition(from, action, ActorSide.CLINIC, 'x')),
    ).toBe('INVALID_TRANSITION');
  });

  it('system actors cannot change links', () => {
    expect(
      code(() =>
        resolveLinkTransition(S.INVITED, 'activate', ActorSide.SYSTEM, null),
      ),
    ).toBe('INVALID_TRANSITION');
  });

  it.each([null, undefined, '', '   '])(
    'suspend needs a reason (%p)',
    (reason) => {
      expect(
        code(() =>
          resolveLinkTransition(S.ACTIVE, 'suspend', ActorSide.CLINIC, reason),
        ),
      ).toBe('LAB_LINK_REASON_REQUIRED');
    },
  );

  describe('who may lift a suspension', () => {
    it.each<[ActorSide | null, ActorSide, boolean]>([
      [ActorSide.CLINIC, ActorSide.CLINIC, true],
      [ActorSide.LAB, ActorSide.LAB, true],
      [ActorSide.LAB, ActorSide.CLINIC, false],
      [ActorSide.CLINIC, ActorSide.LAB, false],
      [ActorSide.PLATFORM, ActorSide.CLINIC, false],
      [ActorSide.CLINIC, ActorSide.PLATFORM, true],
      [null, ActorSide.CLINIC, true],
    ])('suspended by %s, lifted by %s → %s', (by, side, ok) => {
      expect(canLiftSuspension(by, side)).toBe(ok);
    });
  });
});
