import { staffApi } from '@/staff/lib/api';

import {
  appointmentListParams,
  fetchAllDayBookings,
  fetchAppointmentStats,
} from './appointments.api';

jest.mock('@/staff/lib/api', () => ({ staffApi: { get: jest.fn() } }));
jest.mock('@/staff/lib/datetime', () => ({
  clinicDayBounds: (ymd: string) => ({ start: `${ymd}T00:00:00.000Z`, end: `${ymd}T23:59:59.999Z` }),
}));

const get = staffApi.get as jest.Mock;

describe('appointments api', () => {
  beforeEach(() => get.mockReset());

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
});
