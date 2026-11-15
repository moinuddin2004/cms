import { QueryClient, QueryClientProvider, type InfiniteData } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { notificationKeys } from '../api/notifications.keys';
import type { NotificationPage, NotificationPrefs } from '../types/notifications.types';
import {
  useMarkAllRead,
  useMarkRead,
  useNotificationsInfinite,
  useSetNotificationSound,
  useUnreadCount,
} from './useNotifications';

const mockApi = {
  fetchNotifications: jest.fn(),
  fetchUnreadCount: jest.fn(),
  markNotificationRead: jest.fn(),
  markAllNotificationsRead: jest.fn(),
  fetchNotificationPrefs: jest.fn(),
  putNotificationSound: jest.fn(),
};
jest.mock('../api/notifications.api', () => ({
  fetchNotifications: (...a: unknown[]) => mockApi.fetchNotifications(...a),
  fetchUnreadCount: (...a: unknown[]) => mockApi.fetchUnreadCount(...a),
  markNotificationRead: (...a: unknown[]) => mockApi.markNotificationRead(...a),
  markAllNotificationsRead: (...a: unknown[]) => mockApi.markAllNotificationsRead(...a),
  fetchNotificationPrefs: (...a: unknown[]) => mockApi.fetchNotificationPrefs(...a),
  putNotificationSound: (...a: unknown[]) => mockApi.putNotificationSound(...a),
}));
jest.mock('sonner-native', () => ({ toast: { error: jest.fn() } }));

const row = (id: string, readAt: string | null = null) => ({
  id,
  organizationId: 'o1',
  eventCode: 'x',
  title: id,
  body: '',
  link: null,
  readAt,
  createdAt: '2026-11-14T10:00:00.000Z',
});

function seededClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const page: NotificationPage = {
    data: [row('a'), row('b', '2026-11-14T09:00:00Z')],
    total: 2,
    page: 1,
    limit: 20,
    totalPages: 1,
  };
  const data: InfiniteData<NotificationPage, number> = { pages: [page], pageParams: [1] };
  client.setQueryData(notificationKeys.inbox(false), data);
  client.setQueryData(notificationKeys.unreadCount(), 3);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

const listRows = (client: QueryClient) =>
  client.getQueryData<InfiniteData<NotificationPage, number>>(notificationKeys.inbox(false))!
    .pages[0]!.data;

beforeEach(() => jest.resetAllMocks());

describe('queries', () => {
  it('useUnreadCount returns the count', async () => {
    mockApi.fetchUnreadCount.mockResolvedValue(7);
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = await renderHook(() => useUnreadCount(), { wrapper });
    await waitFor(() => expect(result.current.data).toBe(7));
  });

  it('useNotificationsInfinite pages by totalPages', async () => {
    mockApi.fetchNotifications.mockResolvedValueOnce({
      data: [row('a')],
      total: 2,
      page: 1,
      limit: 20,
      totalPages: 2,
    });
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = await renderHook(() => useNotificationsInfinite(), { wrapper });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    expect(mockApi.fetchNotifications).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      unreadOnly: false,
    });
  });
});

describe('useMarkRead', () => {
  it('optimistically marks the row read and lowers the count by 1', async () => {
    let resolve!: (v: unknown) => void;
    mockApi.markNotificationRead.mockReturnValue(new Promise((r) => (resolve = r)));
    const { client, wrapper } = seededClient();
    const { result } = await renderHook(() => useMarkRead(), { wrapper });

    await act(async () => {
      result.current.mutate('a');
    });
    await waitFor(() => expect(client.getQueryData(notificationKeys.unreadCount())).toBe(2));
    expect(listRows(client)[0]!.readAt).not.toBeNull();

    await act(async () => resolve(row('a', 'x')));
  });

  it('does not lower the count for an already-read row', async () => {
    mockApi.markNotificationRead.mockReturnValue(new Promise(() => {}));
    const { client, wrapper } = seededClient();
    const { result } = await renderHook(() => useMarkRead(), { wrapper });
    await act(async () => {
      result.current.mutate('b');
    });
    await waitFor(() => expect(mockApi.markNotificationRead).toHaveBeenCalled());
    expect(client.getQueryData(notificationKeys.unreadCount())).toBe(3);
  });

  it('rolls back list and count on error', async () => {
    mockApi.markNotificationRead.mockRejectedValue(new Error('boom'));
    const { client, wrapper } = seededClient();
    const { result } = await renderHook(() => useMarkRead(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('a').catch(() => undefined);
    });

    expect(client.getQueryData(notificationKeys.unreadCount())).toBe(3);
    expect(listRows(client)[0]!.readAt).toBeNull();
  });
});

describe('useMarkRead invalidation', () => {
  it('refreshes list + unread count but not prefs', async () => {
    mockApi.markNotificationRead.mockResolvedValue(undefined);
    const { client, wrapper } = seededClient();
    const spy = jest.spyOn(client, 'invalidateQueries');
    const { result } = await renderHook(() => useMarkRead(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync('a');
    });
    const keys = spy.mock.calls.map((c) => (c[0] as { queryKey: unknown }).queryKey);
    expect(keys).toContainEqual(notificationKeys.list());
    expect(keys).toContainEqual(notificationKeys.unreadCount());
    expect(keys).not.toContainEqual(notificationKeys.all);
  });
});

describe('useMarkAllRead', () => {
  it('invalidates every notifications query on success', async () => {
    mockApi.markAllNotificationsRead.mockResolvedValue({ updated: 3 });
    const { client, wrapper } = seededClient();
    const spy = jest.spyOn(client, 'invalidateQueries');
    const { result } = await renderHook(() => useMarkAllRead(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync();
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: notificationKeys.all });
  });
});

describe('useSetNotificationSound', () => {
  const prefs = (sound: boolean): NotificationPrefs => ({ sound, email: [] });

  it('optimistically flips sound and sends only sound', async () => {
    let resolve!: (v: NotificationPrefs) => void;
    mockApi.putNotificationSound.mockReturnValue(new Promise((r) => (resolve = r)));
    const { client, wrapper } = seededClient();
    client.setQueryData(notificationKeys.prefs(), prefs(true));
    const { result } = await renderHook(() => useSetNotificationSound(), { wrapper });

    await act(async () => {
      result.current.mutate(false);
    });
    await waitFor(() =>
      expect(client.getQueryData<NotificationPrefs>(notificationKeys.prefs())!.sound).toBe(false),
    );
    await act(async () => resolve(prefs(false)));
    expect(mockApi.putNotificationSound).toHaveBeenCalledWith(false);
  });

  it('rolls back on error', async () => {
    mockApi.putNotificationSound.mockRejectedValue(new Error('boom'));
    const { client, wrapper } = seededClient();
    client.setQueryData(notificationKeys.prefs(), prefs(true));
    const { result } = await renderHook(() => useSetNotificationSound(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(false).catch(() => undefined);
    });
    expect(client.getQueryData<NotificationPrefs>(notificationKeys.prefs())!.sound).toBe(true);
  });
});
