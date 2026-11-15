import { CircleCheck, Link2Off, QrCode as QrIcon, RefreshCw, Share2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Share, View } from 'react-native';

import {
  ConfirmDialog,
  ErrorState,
  LoadingSkeleton,
  QrCode,
  Screen,
  ScreenHeader,
} from '@/core/components';
import { Button } from '@/core/ui/button';
import { Icon } from '@/core/ui/icon';
import { Text } from '@/core/ui/text';
import { useAccess } from '@/staff/features/access';
import { formatDate } from '@/staff/lib/datetime';

import { useAppLink, useCreateClaimToken, useRevokeAppLink } from '../hooks/useAppLink';
import { formatCountdown, secondsLeft } from '../lib/countdown';
import type { IssuedClaim } from '../types/app-link.types';

/** Ticks once a second; `now` is state so the countdown re-renders. */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

/**
 * S-09 "Link app" (docs/06): the link status, a QR the patient scans with their
 * phone camera (15 min, single use), regenerate, and revoke. The raw token lives
 * only in this component's state — never in the query cache, logs or storage.
 */
export function AppLinkPage({ patientId }: { patientId: string }) {
  const { can } = useAccess();
  const allowed = can('patients.app_link.manage');
  const status = useAppLink(patientId);
  const create = useCreateClaimToken(patientId);
  const revoke = useRevokeAppLink(patientId);
  const [issued, setClaim] = useState<IssuedClaim | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const linked = status.data?.status === 'active';
  // Once the patient has claimed it the QR is no longer useful: drop the secret.
  const claim = linked ? null : issued;
  const now = useNow(claim !== null);
  const remaining = claim ? secondsLeft(claim.deadlineMs, now) : 0;
  const expired = claim !== null && remaining === 0;

  const share = () => {
    // The built-in share sheet (WhatsApp is one of its targets); it carries the link, never patient data.
    void Share.share({ message: claim?.url ?? '' }).catch(() => undefined);
  };

  const generate = () => {
    create.mutate(undefined, { onSuccess: (result) => setClaim(result) });
  };

  const header = <ScreenHeader title="Link app" subtitle="Let the patient see their records in the app" />;

  if (!allowed) {
    return (
      <Screen header={header}>
        <ErrorState
          title="Not allowed"
          message="You do not have permission to link the patient app."
          className="flex-1 justify-center"
        />
      </Screen>
    );
  }

  if (status.isPending) {
    return (
      <Screen header={header}>
        <LoadingSkeleton rows={3} />
      </Screen>
    );
  }

  if (status.isError || !status.data) {
    return (
      <Screen header={header}>
        <ErrorState className="flex-1 justify-center" onRetry={() => void status.refetch()} />
      </Screen>
    );
  }

  const { link } = status.data;

  return (
    <Screen scroll header={header} contentClassName="gap-5 px-4 pb-6">
      {linked && link ? (
        <View className="border-border bg-card gap-3 rounded-lg border p-4">
          <View className="flex-row items-center gap-2">
            <Icon as={CircleCheck} className="text-primary size-5" />
            <Text variant="large">{`Linked${link.maskedEmail ? ` to ${link.maskedEmail}` : ''}`}</Text>
          </View>
          <Text variant="muted">{`Since ${formatDate(link.linkedAt)}`}</Text>
          <Button
            variant="destructive"
            className="min-h-11"
            disabled={revoke.isPending}
            accessibilityState={{ busy: revoke.isPending, disabled: revoke.isPending }}
            onPress={() => setConfirmRevoke(true)}>
            <Icon as={Link2Off} className="size-5 text-destructive-foreground" />
            <Text>Revoke link</Text>
          </Button>
        </View>
      ) : (
        <View className="gap-4">
          {claim && !expired ? (
            <View className="border-border bg-card items-center gap-3 rounded-lg border p-4">
              <QrCode
                value={claim.url}
                accessibilityLabel="QR code to link the patient app"
              />
              <Text variant="h3">
                {formatCountdown(remaining)}
              </Text>
              <Text variant="muted" className="text-center">
                Ask the patient to scan with their phone camera. The code works once.
              </Text>
              <Button variant="outline" className="min-h-11 self-stretch" onPress={share}>
                <Icon as={Share2} className="size-5" />
                <Text>Share link</Text>
              </Button>
            </View>
          ) : (
            <View className="border-border bg-card items-center gap-2 rounded-lg border p-6">
              <Icon as={QrIcon} className="text-muted-foreground size-10" />
              <Text className="text-center">
                {expired
                  ? 'The code expired. Generate a new one.'
                  : status.data.pendingClaim
                    ? 'A code was already created. Generate a new one to show it again.'
                    : 'This patient has not linked the app yet.'}
              </Text>
            </View>
          )}
          <Button
            className="min-h-11"
            variant={claim && !expired ? 'outline' : 'default'}
            disabled={create.isPending}
            accessibilityState={{ busy: create.isPending, disabled: create.isPending }}
            onPress={generate}>
            <Icon
              as={claim ? RefreshCw : QrIcon}
              className={claim && !expired ? 'size-5' : 'text-primary-foreground size-5'}
            />
            <Text>
              {create.isPending ? 'Creating…' : claim ? 'Generate a new code' : 'Generate QR'}
            </Text>
          </Button>
        </View>
      )}

      <ConfirmDialog
        open={confirmRevoke}
        onClose={() => setConfirmRevoke(false)}
        title="Revoke app link?"
        description="The patient will stop seeing this clinic's records in their app. They can link again with a new code."
        confirmLabel="Revoke link"
        cancelLabel="Cancel"
        destructive
        onConfirm={() => revoke.mutateAsync()}
      />
    </Screen>
  );
}
