import { fetchNotifications, putNotificationSound } from './notifications.api';

const mockGet = jest.fn();
const mockPut = jest.fn();
jest.mock('@/staff/lib/api', () => ({
  staffApi: { get: (...a: unknown[]) => mockGet(...a), put: (...a: unknown[]) => mockPut(...a) },
}));

describe('notifications api', () => {
  beforeEach(() => jest.resetAllMocks());

  it('clamps limit to 50 and only sends unreadOnly when true', async () => {
    mockGet.mockResolvedValue({ data: { data: { data: [] } } });
    await fetchNotifications({ page: 2, limit: 500 });
    expect(mockGet).toHaveBeenCalledWith('/me/notifications', { params: { page: 2, limit: 50 } });
    await fetchNotifications({ page: 1, unreadOnly: true });
    expect(mockGet).toHaveBeenLastCalledWith('/me/notifications', {
      params: { page: 1, limit: 20, unreadOnly: 'true' },
    });
  });

  it('PUTs only sound', async () => {
    mockPut.mockResolvedValue({ data: { data: { sound: false, email: [] } } });
    await putNotificationSound(false);
    expect(mockPut).toHaveBeenCalledWith('/me/notifications/prefs', { sound: false });
  });
});
