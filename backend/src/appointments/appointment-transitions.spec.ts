import { UnprocessableEntityException } from '@nestjs/common';
import { AppointmentStatus as S } from 'src/common/enums/appointment-status.enum';
import {
  APPOINTMENT_TRANSITIONS,
  assertEditable,
  assertTransition,
  canTransition,
} from './appointment-transitions';

describe('appointment transitions', () => {
  it('covers every status', () => {
    for (const status of Object.values(S)) {
      expect(APPOINTMENT_TRANSITIONS[status]).toBeDefined();
    }
  });

  it.each([
    [S.SCHEDULED, S.CONFIRMED],
    [S.SCHEDULED, S.CHECKED_IN],
    [S.CONFIRMED, S.NO_SHOW],
    [S.CHECKED_IN, S.COMPLETED],
    [S.CHECKED_IN, S.CANCELLED],
  ])('allows %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each([
    // gap 5: confirm must not resurrect closed appointments
    [S.CANCELLED, S.CONFIRMED],
    [S.COMPLETED, S.CONFIRMED],
    // gap 5: no-show only before arrival
    [S.CANCELLED, S.NO_SHOW],
    [S.CHECKED_IN, S.NO_SHOW],
    [S.COMPLETED, S.NO_SHOW],
    [S.SCHEDULED, S.COMPLETED],
    [S.CHECKED_IN, S.CHECKED_IN],
    [S.NO_SHOW, S.CHECKED_IN],
  ])('rejects %s → %s with 422', (from, to) => {
    expect(() => assertTransition(from, to)).toThrow(
      UnprocessableEntityException,
    );
  });

  it('only lets bookings be edited before check-in', () => {
    expect(() => assertEditable(S.SCHEDULED)).not.toThrow();
    expect(() => assertEditable(S.CONFIRMED)).not.toThrow();
    expect(() => assertEditable(S.CHECKED_IN)).toThrow(
      UnprocessableEntityException,
    );
    expect(() => assertEditable(S.COMPLETED)).toThrow(
      UnprocessableEntityException,
    );
  });
});
