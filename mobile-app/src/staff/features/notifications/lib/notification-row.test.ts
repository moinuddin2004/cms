import type { NotificationItem } from '../types/notifications.types';
import { describeNotification } from './notification-row';

jest.mock('@/staff/lib/datetime', () => ({
  formatDateTime: (v: string) => `fmt(${v})`,
}));

const base: NotificationItem = {
  id: 'n1',
  organizationId: 'o1',
  eventCode: 'queue.patient_arrived',
  title: 'Patient arrived',
  body: 'A-007 is waiting',
  link: '/queue/doctor',
  readAt: null,
  createdAt: '2026-11-14T10:00:00.000Z',
};

describe('describeNotification', () => {
  it('unread row in the active clinic', () => {
    expect(describeNotification(base, 'o1', {})).toEqual({
      title: 'Patient arrived',
      body: 'A-007 is waiting',
      time: 'fmt(2026-11-14T10:00:00.000Z)',
      unread: true,
      otherClinic: null,
    });
  });
  it('read row', () => {
    const read = { ...base, readAt: '2026-11-14T11:00:00Z' };
    expect(describeNotification(read, 'o1', {}).unread).toBe(false);
  });
  it('other clinic shows its name', () => {
    expect(describeNotification(base, 'o2', { o1: 'City Dental' }).otherClinic).toBe('City Dental');
  });
  it('other clinic with unknown name falls back', () => {
    expect(describeNotification(base, 'o2', {}).otherClinic).toBe('Another clinic');
  });
  it('no active org counts as another clinic', () => {
    expect(describeNotification(base, null, { o1: 'X' }).otherClinic).toBe('X');
  });
});
