import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Ticket } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import {
  ConnectionPill,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  Screen,
  ScreenHeader,
  TokenBadge,
  deriveConnectionState,
} from '@/core/components';
import { formatInZone } from '@/core/datetime';
import { useT } from '@/core/i18n';
import { useOnline } from '@/core/network';
import { Button } from '@/core/ui/button';
import { Text } from '@/core/ui/text';

import { useActiveQueue } from '../hooks/useActiveQueue';
import { aheadText, isCalled, statusText } from '../lib/queue-text';

/** P-06 Live token: one entry, updated by realtime (polling while the socket is down). */
export function VisitPage({ entryId }: { entryId: string }) {
  const { t } = useT();
  const router = useRouter();
  const online = useOnline();
  const { data, isPending, isError, refetch, live, dataUpdatedAt } = useActiveQueue();
  const entry = data?.find((e) => e.entryId === entryId) ?? null;
  const called = entry ? isCalled(entry) : false;

  // One buzz when the status turns to "called", never for an entry that was already called on open.
  const wasCalled = useRef<boolean | null>(null);
  useEffect(() => {
    if (!entry) return;
    if (wasCalled.current === false && called) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
    }
    wasCalled.current = called;
  }, [called, entry]);

  const header = (
    <ScreenHeader
      title={entry ? `${entry.clinic.name} · ${entry.location.name}` : t('visit.title')}
      backLabel={t('common.back')}
    />
  );

  if (isPending) {
    return (
      <Screen header={header}>
        <LoadingSkeleton rows={3} />
      </Screen>
    );
  }
  if (isError && !data) {
    return (
      <Screen header={header}>
        <ErrorState
          title={t('visit.loadFailed.title')}
          message={t('visit.loadFailed.body')}
          retryLabel={t('common.retry')}
          onRetry={() => void refetch()}
        />
      </Screen>
    );
  }
  if (!entry) {
    // Finished, cancelled, or a stale push / deep link: the visit is no longer in the queue.
    return (
      <Screen header={header}>
        <EmptyState icon={Ticket} title={t('visit.over.title')} description={t('visit.over.body')} />
        <View className="px-4">
          <Button size="lg" onPress={() => router.replace('/')}>
            <Text>{t('visit.backHome')}</Text>
          </Button>
        </View>
      </Screen>
    );
  }

  const ahead = aheadText(t, entry);
  const updated = dataUpdatedAt
    ? formatInZone(dataUpdatedAt, entry.location.timezone, 'HH:mm')
    : null;
  const state = deriveConnectionState({ online, realtimeConnected: live });

  return (
    <Screen
      scroll
      header={header}
      refreshing={false}
      onRefresh={() => void refetch()}
      contentClassName="items-center gap-4 px-4">
      <TokenBadge
        token={entry.token}
        size="lg"
        accessibilityLabel={t('visit.cardToken', { token: entry.token })}
      />
      <Text variant="large" className="text-center">
        {statusText(t, entry.status)}
        {entry.doctorName ? ` · ${entry.doctorName}` : ''}
      </Text>

      {called ? (
        <View accessibilityLiveRegion="assertive" className="bg-primary w-full rounded-xl p-4">
          <Text className="text-primary-foreground text-center text-lg font-semibold">
            {entry.doctorName
              ? t('visit.calledBanner', { doctor: entry.doctorName })
              : t('visit.calledBannerNoDoctor')}
          </Text>
        </View>
      ) : null}

      {ahead ? <Text className="text-center text-xl font-medium">{ahead}</Text> : null}
      {entry.nowServingToken ? (
        <Text variant="muted">{t('visit.nowServing', { token: entry.nowServingToken })}</Text>
      ) : null}

      <ConnectionPill
        state={state}
        labels={{
          live: t('visit.live'),
          reconnecting: t('visit.reconnecting'),
          offline: t('visit.offline'),
        }}
      />
      {updated ? (
        <Text variant="muted" className="text-xs">
          {t('visit.updatedAt', { time: updated })}
        </Text>
      ) : null}
      {!called ? (
        <Text variant="muted" className="text-center">
          {t('visit.notifyHint')}
        </Text>
      ) : null}
    </Screen>
  );
}
