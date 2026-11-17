import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';

import { usePatientAuthStore } from '@/patient/store/usePatientAuthStore';

import { useReminderSettings } from '../lib/reminder-settings';
import { ReminderSync } from './ReminderSync';

jest.mock('@/core/notifications/permissions', () => ({
  getPermissionState: jest.fn(async () => 'granted'),
  requestPermission: jest.fn(async () => 'granted'),
}));

let mockReleaseEvents: (v: unknown[]) => void = () => undefined;
jest.mock('../api/medications.api', () => ({
  fetchAllMedications: jest.fn(async () => [
    {
      id: 's1',
      profileId: 'p1',
      source: 'prescription',
      clinic: null,
      prescriptionId: 'rx',
      prescriptionMedicineId: 'm',
      name: 'Amoxicillin',
      nameUrdu: null,
      doseText: '500 mg',
      mealRelation: 'NONE',
      times: ['08:00', '20:00'],
      startDate: '2020-01-01',
      endDate: null,
      endDateSource: 'unknown',
      status: 'active',
      instructions: null,
      instructionsUrdu: null,
      updatedAt: '2026-11-01T00:00:00.000Z',
    },
  ]),
  fetchDoseEvents: jest.fn(() => new Promise((r) => (mockReleaseEvents = r))),
  postDoseEvents: jest.fn(),
}));

describe('ReminderSync waits for dose events (audit L13)', () => {
  it('plans nothing while the first dose-event load is in flight, then plans', async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    usePatientAuthStore.setState({ account: { id: 'acc-1', fullName: 'A', email: 'a@x.com' } });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await render(
      <QueryClientProvider client={client}>
        <ReminderSync />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(useReminderSettings.getState().hydrated).toBe(true), { timeout: 5000 });
    await act(async () => undefined);
    await act(async () => undefined);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

    await act(async () => mockReleaseEvents([]));
    await waitFor(() => expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled(), { timeout: 5000 });
  });
});
