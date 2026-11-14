import { staffApi } from '@/staff/lib/api';

import { log } from '@/core/log';

import {
  MAX_DAY_PAGES,
  appointmentListParams,
  fetchAllDayBookings,
  fetchAppointmentStats,
  fetchUpcomingAppointments,
} from './appointments.api';

jest.mock('@/core/log', () => ({ log: { warn: jest.fn() } }));
jest.mock('@/staff/lib/api', () => ({ staffApi: { get: jest.fn() } }));
jest.mock('@/staff/lib/datetime', () => ({
  clinicDayBounds: (ymd: string) => ({ start: `${ymd}T00:00:00.000Z`, end: `${ymd}T23:59:59.999Z` }),
}));

const get = staffApi.get as jest.Mock;

describe('appointments api', () => {
  beforeEach(() => {
    get.mockReset();
    (log.warn as jest.Mock).mockClear();
  });

  it('builds only params the backend DTO accepts, from the clinic-day bounds', () => {
    expect(appointmentListParams('2026-11-14', {}, 1)).toEqual({
      startDate: '2026-11-14T00:00:00.000Z',
      endDate: '2026-11-14T23:59:59.999Z',
      doctorId: undefined,
      status: undefined,
      includeWalkIns: true,
      search: undefined,
      page: 1,
      limit: 50,
    });
    const p = appointmentListParams(
      '2026-11-14',
      { doctorId: 'd', status: 'confirmed', search: ' ali ', includeWalkIns: false },
      3,
    );
    expect(p).toMatchObject({ doctorId: 'd', status: 'confirmed', search: 'ali', includeWalkIns: false, page: 3 });
    expect(Object.keys(p).sort()).toEqual(
      ['doctorId', 'endDate', 'includeWalkIns', 'limit', 'page', 'search', 'startDate', 'status'].sort(),
    );
  });

  it('asks stats for the day bounds only', async () => {
    get.mockResolvedValue({ data: { data: { total: 1 } } });
    await expect(fetchAppointmentStats('2026-11-14')).resolves.toEqual({ total: 1 });
    expect(get).toHaveBeenCalledWith('/appointments/stats', {
      params: { startDate: '2026-11-14T00:00:00.000Z', endDate: '2026-11-14T23:59:59.999Z' },
    });
  });

  it('loads every page of the day for arrivals, without walk-ins', async () => {
    get
      .mockResolvedValueOnce({ data: { data: { data: [{ id: 'a' }], total: 51, page: 1, limit: 50 } } })
      .mockResolvedValueOnce({ data: { data: { data: [{ id: 'b' }], total: 51, page: 2, limit: 50 } } });
    const rows = await fetchAllDayBookings('2026-11-14');
    expect(rows.map((r) => r.id)).toEqual(['a', 'b']);
    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls[1][1].params).toMatchObject({ page: 2, includeWalkIns: false });
  });

  it('de-duplicates rows that repeat across pages (same start time, skip/take paging)', async () => {
    get
      .mockResolvedValueOnce({ data: { data: { data: [{ id: 'a' }, { id: 'b' }], total: 3, page: 1, limit: 2 } } })
      .mockResolvedValueOnce({ data: { data: { data: [{ id: 'b' }, { id: 'c' }], total: 3, page: 2, limit: 2 } } });
    const rows = await fetchAllDayBookings('2026-11-14');
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('stops at the page cap and warns once, without any payload', async () => {
    let n = 0;
    get.mockImplementation(async () => {
      n += 1;
      return { data: { data: { data: [{ id: `r${n}` }], total: 999999, page: n, limit: 50 } } };
    });
    const rows = await fetchAllDayBookings('2026-11-14');
    expect(get).toHaveBeenCalledTimes(MAX_DAY_PAGES);
    expect(rows).toHaveLength(MAX_DAY_PAGES);
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect((log.warn as jest.Mock).mock.calls[0]).toHaveLength(1);
  });

  it('asks for upcoming bookings from the given instant to the end of the clinic day, no walk-ins', async () => {
    get.mockResolvedValue({ data: { data: { data: [{ id: 'a' }], total: 1, page: 1, limit: 5 } } });
    const rows = await fetchUpcomingAppointments('2026-11-14T09:30:00.000Z', '2026-11-14', 5);
    expect(rows).toEqual([{ id: 'a' }]);
    expect(get.mock.calls[0][1].params).toMatchObject({
      startDate: '2026-11-14T09:30:00.000Z',
      endDate: '2026-11-14T23:59:59.999Z',
      includeWalkIns: false,
      page: 1,
      limit: 5,
    });
  });
});
