import { useRouter } from 'expo-router';
import { BellOff, CalendarCheck, Link2, Settings } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { deviceTimezone, formatInZone } from '@/core/datetime';
import {
  ActionSheet,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingSkeleton,
  Screen,
  ScreenHeader,
  SectionHeader,
} from '@/core/components';
import { useT } from '@/core/i18n';
import { Button } from '@/core/ui/button';
import { Icon } from '@/core/ui/icon';
import { Text } from '@/core/ui/text';
import {
  useDoseActions,
  useDoseQueueStore,
  useEffectiveDoseEvents,
  useMedications,
  useNotificationPermission,
  useReminderProfiles,
} from '@/patient/features/medications';
import { LiveTokenSection } from '@/patient/features/queue';
import { useRecordUpcomingAppointments } from '@/patient/features/records';

import { AppointmentRow } from '../components/AppointmentRow';
import { DoseRow } from '../components/DoseRow';
import { useNow } from '../hooks/useNow';
import { buildTodayDoses, groupDoses, splitAppointments, type TodayDose } from '../lib/today-model';

/**
 * P-02 Today (docs/06): today's doses for the whole family with Taken / Skip, upcoming appointments.
 * Everything is derived on the device from the cached medications, dose events and appointments, so it
 * works offline; a decision is saved locally first and synced later (`useDoseActions`).
 */
export function TodayPage() {
  const { t } = useT();
  const router = useRouter();
  const now = useNow();
  const medications = useMedications();
  const { events, isError: statusFailed, refetch: refetchEvents } = useEffectiveDoseEvents();
  const appointments = useRecordUpcomingAppointments();
  const profiles = useReminderProfiles();
  const permission = useNotificationPermission();
  const queue = useDoseQueueStore((s) => s.items);
  const { record, ready } = useDoseActions();
  const [menuFor, setMenuFor] = useState<TodayDose | null>(null);

  const schedules = medications.data;
  const doses = useMemo(() => (schedules ? buildTodayDoses(schedules, events, now) : []), [schedules, events, now]);
  const sections = useMemo(() => groupDoses(doses), [doses]);
  const appointmentSections = useMemo(
    () => splitAppointments(appointments.data ?? [], now),
    [appointments.data, now],
  );
  const queuedKeys = useMemo(() => new Set(queue.map((q) => `${q.scheduleId}|${Date.parse(q.dueAt)}`)), [queue]);

  const header = (
    <ScreenHeader
      title={t('today.title')}
      subtitle={formatInZone(now, deviceTimezone(), 'EEEE d MMM')}
      back={false}
      backLabel={t('common.back')}
      actions={
        <IconButton icon={Settings} accessibilityLabel={t('today.remindersAction')} onPress={() => router.push('/reminders')} />
      }
    />
  );

  // --- states -----------------------------------------------------------
  if (!schedules && medications.isPending) {
    return <Screen header={header}><LoadingSkeleton /></Screen>;
  }
  if (!schedules && medications.isError) {
    return (
      <Screen header={header}>
        <ErrorState
          title={t('today.error')}
          message={t('today.errorBody')}
          retryLabel={t('common.retry')}
          onRetry={() => void medications.refetch()}
        />
      </Screen>
    );
  }

  const hasReminders = (schedules ?? []).some((s) => s.status === 'active' && s.times.length > 0);
  const nothingAtAll = (schedules ?? []).length === 0 && (appointments.data ?? []).length === 0;
  const refreshing = medications.isRefetching;

  return (
    <Screen
      scroll
      header={header}
      refreshing={refreshing}
      onRefresh={() => {
        void medications.refetch();
        refetchEvents();
        void appointments.refetch();
      }}>
      <View className="gap-4 pb-8 pt-2">
        {/* Live token (M3-06): pinned while any linked entry is active today. */}
        <LiveTokenSection />

        {queue.length > 0 ? (
          <Text variant="muted">
            {queue.length === 1 ? t('today.unsentOne') : t('today.unsentMany', { count: queue.length })}
          </Text>
        ) : null}

        {statusFailed ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('today.statusFailed')}
            onPress={refetchEvents}
            className="bg-card border-destructive min-h-11 justify-center rounded-xl border p-3">
            <Text className="text-destructive">{t('today.statusFailed')}</Text>
          </Pressable>
        ) : null}

        {hasReminders && permission.state === 'undetermined' ? (
          <View className="bg-card border-border gap-2 rounded-xl border p-4">
            <Text variant="large">{t('today.turnOnTitle')}</Text>
            <Text variant="muted">{t('today.turnOnBody')}</Text>
            <Button className="min-h-11" onPress={() => void permission.request()}>
              <Text>{t('reminders.settings.turnOn')}</Text>
            </Button>
          </View>
        ) : null}
        {hasReminders && permission.state === 'denied' ? (
          <View className="bg-card border-border gap-2 rounded-xl border p-4">
            <View className="flex-row items-center gap-2">
              <Icon as={BellOff} className="text-destructive size-5" />
              <Text variant="large">{t('today.deniedTitle')}</Text>
            </View>
            <Text variant="muted">{t('today.deniedBody')}</Text>
            <Button variant="outline" className="min-h-11" onPress={() => void Linking.openSettings()}>
              <Text>{t('reminders.settings.openSettings')}</Text>
            </Button>
          </View>
        ) : null}

        {nothingAtAll ? (
          <EmptyState icon={Link2} title={t('today.firstTitle')} description={t('today.firstBody')} className="py-10" />
        ) : (
          <>
            {sections.length === 0 ? (
              <EmptyState
                icon={CalendarCheck}
                title={t('today.nothingDue')}
                description={t('today.nothingDueBody')}
                className="py-10"
              />
            ) : (
              sections.map((section) => (
                <View key={section.group} className="gap-2">
                  <SectionHeader inset={false} title={t(`today.groups.${section.group}`)} />
                  <View className="gap-2">
                    {section.doses.map((dose) => (
                      <DoseRow
                        key={dose.key}
                        dose={dose}
                        profileName={profiles.nameOf(dose.profileId)}
                        waitingToSync={queuedKeys.has(dose.key)}
                        disabled={!ready}
                        onTaken={() => record(dose.scheduleId, dose.dueAt, 'taken')}
                        onMore={() => setMenuFor(dose)}
                      />
                    ))}
                  </View>
                </View>
              ))
            )}

            {appointmentSections.today.length > 0 ? (
              <View className="gap-2">
                <SectionHeader inset={false} title={t('today.appointmentsToday')} />
                {appointmentSections.today.map((a) => (
                  <AppointmentRow key={a.id} item={a} withDay={false} />
                ))}
              </View>
            ) : null}

            {appointmentSections.comingUp.length > 0 ? (
              <View className="gap-2">
                <SectionHeader inset={false} title={t('today.comingUp')} />
                {appointmentSections.comingUp.map((a) => (
                  <AppointmentRow key={a.id} item={a} withDay />
                ))}
              </View>
            ) : null}
          </>
        )}
      </View>

      <ActionSheet
        open={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={menuFor?.name}
        cancelLabel={t('common.cancel')}
        actions={[
          {
            label: t('today.skipDose'),
            onPress: () => {
              if (menuFor) record(menuFor.scheduleId, menuFor.dueAt, 'skipped');
              setMenuFor(null);
            },
          },
        ]}
      />
    </Screen>
  );
}
