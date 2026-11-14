import { useRouter } from 'expo-router';
import { EllipsisVertical, Stethoscope, UserX } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import {
  ActionSheet,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingSkeleton,
  OfflineAwareButton,
  type SheetAction,
} from '@/core/components';
import { Text } from '@/core/ui/text';
import { useAccess } from '@/staff/features/access';
import { RealtimeConnectionPill } from '@/staff/lib/realtime-connection-pill';

import { useMySession } from '../hooks/useMySession';
import type { EntryActionId } from '../lib/entry-actions';
import { queueErrorCode } from '../lib/queue-errors';
import type { EntryView } from '../types/queue.types';
import { DoctorQueueList, waitingEntries } from './doctor/DoctorQueueList';
import { ReasonSheet, type ReasonRequest } from './doctor/ReasonSheet';
import { ClosedSummaryCard, StartSessionCard } from './doctor/SessionPanels';
import { useDoctorQueueActions } from './doctor/useDoctorQueueActions';

type ReasonKind = 'pause' | 'send-for-test' | 'abort' | 'select';
interface ReasonTarget {
  id: string;
  kind: ReasonKind;
  entryId?: string;
}

/**
 * S-02a doctor view (docs/06): the signed-in doctor's session for today. Owns
 * the data (`useMySession`), the action wiring and the sheets; the body for an
 * open / paused session lives in `doctor/DoctorQueueList`.
 */
export function DoctorQueueView() {
  const query = useMySession();
  const actions = useDoctorQueueActions();
  const router = useRouter();
  const { can } = useAccess();
  const [refreshing, setRefreshing] = useState(false);
  const [rowMenu, setRowMenu] = useState<EntryView | null>(null);
  const [sessionMenu, setSessionMenu] = useState(false);
  const [target, setTarget] = useState<ReasonTarget | null>(null);
  // Abort asks twice: the reason sheet, then this confirmation (nothing is sent before it).
  const [abortConfirm, setAbortConfirm] = useState<{ entryId: string; reason?: string } | null>(
    null,
  );

  const snapshot = query.data;
  if (!snapshot) {
    // No doctor profile at this location: nothing to retry, so explain instead.
    if (query.isError && queueErrorCode(query.error) === 'NOT_FOUND') {
      return (
        <EmptyState
          icon={UserX}
          title="You are not set up as a doctor at this location."
          description="Ask your clinic owner to add you as a doctor here."
          className="flex-1 justify-center"
        />
      );
    }
    if (query.isError)
      return <ErrorState onRetry={() => void query.refetch()} className="flex-1 justify-center" />;
    return <LoadingSkeleton />;
  }

  const { session } = snapshot;
  const entryById = (id?: string) => snapshot.entries.find((e) => e.id === id);
  const current =
    snapshot.entries.find((e) => e.status === 'called' || e.status === 'in_consultation') ?? null;
  const waiting = waitingEntries(snapshot);
  // One action at a time: Call next and the row menus wait for any running mutation.
  const locked = actions.sessionBusy || actions.busyEntryIds.size > 0;

  const refresh = async () => {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  };
  const openReason = (kind: ReasonKind, entryId?: string) =>
    setTarget({
      id: `${kind}-${entryId ?? 'session'}-${Date.now()}`,
      kind,
      entryId,
    });

  const onEntryAction = (action: EntryActionId, entry: EntryView) => {
    switch (action) {
      case 'start':
        return actions.startConsultation(entry);
      case 'complete':
        return actions.complete(entry);
      case 'recall':
        return actions.recall(entry);
      case 'undo-call':
        return actions.undoCall(entry);
      case 'skip':
        return actions.skip(entry);
      case 'send-for-test':
        return openReason('send-for-test', entry.id);
      case 'abort':
        return openReason('abort', entry.id);
      case 'patient-file':
        if (entry.patient) {
          router.push({
            pathname: '/patients/[patientId]',
            params: { patientId: entry.patient.id },
          });
        }
        return;
      default:
        return;
    }
  };

  const callThisPatient = (entry: EntryView) => {
    if (locked) return;
    // Jumping the suggested order is the case worth a reason (docs/06 S-02a).
    const jumps = snapshot.suggestion
      ? snapshot.suggestion.entryId !== entry.id
      : waiting[0]?.id !== entry.id;
    if (jumps) openReason('select', entry.id);
    else void actions.select(entry, undefined);
  };

  const request = ((): ReasonRequest | null => {
    if (!target) return null;
    const entry = entryById(target.entryId);
    // The entry left the queue while the sheet was open: nothing to act on, let it close.
    const gone = target.kind !== 'pause' && !entry;
    const base = { id: target.id, fieldLabel: 'Reason', required: false };
    switch (target.kind) {
      case 'pause':
        return {
          ...base,
          title: 'Pause session',
          description: 'Patients keep waiting; no one can be called until you resume.',
          required: true,
          submitLabel: 'Pause',
          onSubmit: (reason) => actions.pauseSession(session.id, reason),
        };
      case 'send-for-test':
        return {
          ...base,
          title: 'Send for test',
          description: 'The patient goes on hold and can rejoin when they are back.',
          submitLabel: 'Send for test',
          onSubmit: (reason) =>
            gone || !entry ? Promise.resolve(true) : actions.sendForTest(entry, reason),
        };
      case 'abort':
        return {
          ...base,
          title: 'Abort consultation',
          description: 'This ends the visit without completing it. It cannot be undone.',
          submitLabel: 'Abort consultation',
          destructive: true,
          onSubmit: (reason) => {
            if (entry && !gone) setAbortConfirm({ entryId: entry.id, reason });
            return Promise.resolve(true);
          },
        };
      case 'select':
        return {
          ...base,
          title: 'Call out of order',
          description: entry ? `Call ${entry.token} instead of the suggested patient.` : undefined,
          submitLabel: 'Call patient',
          onSubmit: (reason) =>
            gone || !entry ? Promise.resolve(true) : actions.select(entry, reason),
        };
      default: {
        const _never: never = target.kind;
        return _never;
      }
    }
  })();

  const sessionActions: SheetAction[] = [];
  if (session.status === 'open') {
    sessionActions.push({
      label: 'Pause session',
      onPress: () => openReason('pause'),
    });
  }
  if (session.status === 'paused') {
    sessionActions.push({
      label: 'Resume session',
      onPress: () => actions.resumeSession(session.id),
    });
  }
  if (
    (session.status === 'open' || session.status === 'paused') &&
    can('queue.entry.reprioritize')
  ) {
    sessionActions.push({
      label: session.smartQueueEnabled ? 'Turn smart order off' : 'Turn smart order on',
      onPress: () => actions.setSmartOrder(session.id, !session.smartQueueEnabled),
    });
  }

  const summary =
    session.status === 'open'
      ? `Session open · ${waiting.length} waiting`
      : session.status === 'paused'
        ? `Session paused · ${waiting.length} waiting`
        : session.status === 'closed'
          ? 'Session closed'
          : 'Session not started';

  const topBar = (
    <View className="gap-1 px-4">
      <View className="flex-row items-center justify-between">
        <RealtimeConnectionPill />
        {sessionActions.length > 0 ? (
          <IconButton
            icon={EllipsisVertical}
            accessibilityLabel="Session actions"
            disabled={actions.sessionBusy}
            onPress={() => setSessionMenu(true)}
          />
        ) : null}
      </View>
      <Text variant="muted" accessibilityRole="header">
        {summary}
      </Text>
    </View>
  );

  const body =
    session.status === 'waiting_for_doctor' || session.status === 'closed' ? (
      <View className="flex-1 gap-3">
        {topBar}
        {session.status === 'closed' ? (
          <ClosedSummaryCard session={session} entries={snapshot.entries} />
        ) : (
          <StartSessionCard
            busy={actions.sessionBusy}
            onStart={() => actions.startSession(session.id)}
          />
        )}
      </View>
    ) : (
      <DoctorQueueList
        snapshot={snapshot}
        current={current}
        busyEntryIds={actions.busyEntryIds}
        sessionBusy={actions.sessionBusy}
        topBar={topBar}
        refreshing={refreshing}
        onRefresh={() => void refresh()}
        onEntryAction={onEntryAction}
        onRowMenu={setRowMenu}
        onResume={() => actions.resumeSession(session.id)}
      />
    );

  const showCallNext = (session.status === 'open' || session.status === 'paused') && !current;

  return (
    <View className="flex-1">
      <View className="flex-1">{body}</View>
      {showCallNext ? (
        <View className="border-border bg-background border-t px-4 py-3">
          <OfflineAwareButton
            label="Call next"
            className="min-h-12"
            disabled={session.status !== 'open' || locked}
            accessibilityState={{ busy: actions.sessionBusy }}
            onPress={() => void actions.callNext(session.id)}
          />
        </View>
      ) : null}
      <ActionSheet
        open={sessionMenu}
        onClose={() => setSessionMenu(false)}
        title="Session"
        cancelLabel="Cancel"
        actions={sessionActions.map((a) => ({
          ...a,
          onPress: () => {
            setSessionMenu(false);
            a.onPress();
          },
        }))}
      />
      <ActionSheet
        open={rowMenu !== null}
        onClose={() => setRowMenu(null)}
        title={rowMenu?.token}
        cancelLabel="Cancel"
        actions={[
          {
            label: 'Call this patient',
            icon: Stethoscope,
            onPress: () => {
              const entry = rowMenu;
              setRowMenu(null);
              if (entry) callThisPatient(entry);
            },
          },
        ]}
      />
      <ReasonSheet request={request} onClose={() => setTarget(null)} />
      <ConfirmDialog
        open={abortConfirm !== null}
        onClose={() => setAbortConfirm(null)}
        title="Abort consultation?"
        description="This ends the visit without completing it. It cannot be undone."
        confirmLabel="Abort consultation"
        cancelLabel="Keep consultation"
        destructive
        onConfirm={async () => {
          // The entry as it is now on screen (version for If-Match); gone = nothing left to abort.
          const entry = entryById(abortConfirm?.entryId);
          if (entry && !(await actions.abort(entry, abortConfirm?.reason))) {
            throw new Error('abort failed'); // keeps the dialog open for a retry
          }
        }}
      />
    </View>
  );
}
