import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { Pressable, Text } from 'react-native';

import { usePatientAuthStore } from '@/patient/store/usePatientAuthStore';

import { useNotificationPermission } from '../hooks/useNotificationPermission';
import { useDoseQueueStore } from '../lib/dose-queue';
import { useReminderSettings } from '../lib/reminder-settings';
import { ReminderSync } from './ReminderSync';

jest.mock('react-native-reanimated', () => ({}));

let mockPermission: 'granted' | 'undetermined' | 'denied' = 'undetermined';
jest.mock('@/core/notifications/permissions', () => ({
  getPermissionState: jest.fn(async () => mockPermission),
  requestPermission: jest.fn(async () => {
    mockPermission = 'granted';
    return 'granted';
  }),
}));

const mockMeds = jest.fn();
jest.mock('../api/medications.api', () => ({
  fetchAllMedications: (...a: unknown[]) => mockMeds(...a),
  fetchDoseEvents: jest.fn(async () => []),
  postDoseEvents: jest.fn(),
}));

const schedule = {
  id: 's1',
  profileId: 'p1',
  source: 'prescription',
  clinic: null,
  prescriptionId: 'rx',
  prescriptionMedicineId: 'm',
  name: 'Amoxicillin',
  nameUrdu: null,
  doseText: '500 mg',
  mealRelation: 'AFTER_MEAL',
  times: ['08:00', '20:00'],
  startDate: '2020-01-01',
  endDate: null,
  endDateSource: 'unknown',
  status: 'active',
  instructions: null,
  instructionsUrdu: null,
  updatedAt: '2026-11-01T00:00:00.000Z',
};

function GrantButton() {
  const { request } = useNotificationPermission();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="grant" onPress={() => void request()}>
      <Text>grant</Text>
    </Pressable>
  );
}

const schedulePending = () => (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;

async function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ReminderSync />
      <GrantButton />
    </QueryClientProvider>,
  );
}

afterEach(async () => {
  cleanup(); // unmount first, so no old tree reacts to the next test's setup
  await act(async () => undefined);
  usePatientAuthStore.setState({ account: null });
});

beforeEach(async () => {
  jest.clearAllMocks();
  mockPermission = 'undetermined';
  mockMeds.mockResolvedValue([schedule]);
  await Notifications.cancelAllScheduledNotificationsAsync();
  useDoseQueueStore.getState().reset();
  useReminderSettings.getState().reset();
  usePatientAuthStore.setState({ account: { id: 'acc-1', fullName: 'A', email: 'a@x.com' } });
});

describe('ReminderSync', () => {
  it('schedules nothing without permission, re-plans right after it is granted, and private reminders never print the medicine', async () => {
    await mount();
    await waitFor(() => expect(useReminderSettings.getState().hydrated).toBe(true), { timeout: 5000 });
    await act(async () => undefined);
    expect(schedulePending()).toHaveLength(0);

    fireEvent.press(screen.getByLabelText('grant'));
    await waitFor(() => expect(schedulePending().length).toBeGreaterThan(0));
    for (const [request] of schedulePending()) expect(request.identifier).toMatch(/^dose\./);
    expect(JSON.stringify(schedulePending()[0])).toContain('Amoxicillin');

    // Switching private on replaces every pending reminder with one that has no medicine in it.
    act(() => useReminderSettings.getState().setPrivateReminders(true));
    await waitFor(async () => {
      const pending = await Notifications.getAllScheduledNotificationsAsync();
      expect(pending.length).toBeGreaterThan(0);
      for (const n of pending) expect(JSON.stringify((n as { content?: unknown }).content)).not.toContain('Amoxicillin');
    });
  });

  it('does not plan while the private-reminders choice is still unknown', async () => {
    mockPermission = 'granted';
    // Same account already "loading": hydrate() returns early, so the choice stays unknown.
    useReminderSettings.setState({ accountId: 'acc-1', hydrated: false, privateReminders: false });
    await mount();
    await act(async () => undefined);
    await act(async () => undefined);
    expect(useReminderSettings.getState().hydrated).toBe(false);
    expect(schedulePending()).toHaveLength(0);
  });
});
