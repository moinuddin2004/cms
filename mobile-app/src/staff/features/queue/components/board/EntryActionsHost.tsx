import { useRouter } from 'expo-router';
import {
  ArrowRightLeft,
  CircleX,
  RotateCcw,
  SkipForward,
  Ticket,
  TriangleAlert,
  Undo2,
  User,
  type LucideIcon,
} from 'lucide-react-native';

import { toast } from 'sonner-native';

import { ActionSheet, ConfirmDialog, type SheetAction } from '@/core/components';
import { useCanMutate } from '@/core/http';
import { useAccess } from '@/staff/features/access';

import { availableEntryActions, type EntryActionId } from '../../lib/entry-actions';
import type { LaneDoctor } from '../../types/queue.types';
import type { OpenLane } from './board-model';
import { BOARD_ACTION_LABELS, sheetActionIds } from './entry-sheet-actions';
import type { BoardActions } from './useBoardActions';
import { useBoardUiStore } from './useBoardUiStore';
import { UrgentReasonSheet } from './UrgentReasonSheet';

const ICONS: Partial<Record<EntryActionId, LucideIcon>> = {
  'mark-urgent': TriangleAlert,
  transfer: ArrowRightLeft,
  skip: SkipForward,
  rejoin: Undo2,
  'return-from-test': RotateCcw,
  cancel: CircleX,
  'patient-file': User,
  'show-ticket': Ticket,
};

const GONE = 'This patient is no longer in the queue.';

export interface EntryActionsHostProps {
  lane: OpenLane;
  /** Every doctor on the board (transfer targets). */
  doctors: LaneDoctor[];
  actions: BoardActions;
}

/**
 * Everything a row's ⋯ can open: the ActionSheet, then (per choice) the urgent
 * reason sheet, the transfer doctor picker or the cancel confirmation. State
 * lives in `useBoardUiStore` (ids only); the entry is looked up live so the
 * sheet never acts on a stale copy.
 */
export function EntryActionsHost({ lane, doctors, actions }: EntryActionsHostProps) {
  const router = useRouter();
  const { can } = useAccess();
  const canMutate = useCanMutate();
  const { actionEntryId, actionOpen, flow, closeActions, startFlow, endFlow, showTicket } =
    useBoardUiStore();

  const entry = lane.snapshot.entries.find((e) => e.id === actionEntryId);
  const flowEntry =
    flow && flow.kind !== 'open-lane'
      ? lane.snapshot.entries.find((e) => e.id === flow.entryId)
      : undefined;

  const ids = entry
    ? sheetActionIds(availableEntryActions(entry, lane.snapshot.session, can, 'board'), canMutate)
    : [];

  const run = (id: EntryActionId): (() => void) => {
    if (!entry) return () => undefined;
    switch (id) {
      case 'mark-urgent':
        return () => startFlow({ kind: 'urgent', entryId: entry.id });
      case 'transfer':
        return () => startFlow({ kind: 'transfer', entryId: entry.id });
      case 'cancel':
        return () => startFlow({ kind: 'cancel', entryId: entry.id });
      case 'skip':
        return () => void actions.skip(entry).catch(() => undefined);
      case 'rejoin':
        return () => void actions.rejoin(entry).catch(() => undefined);
      case 'return-from-test':
        return () => void actions.backFromTest(entry).catch(() => undefined);
      case 'patient-file':
        return () => {
          if (entry.patient) {
            router.push({
              pathname: '/patients/[patientId]',
              params: { patientId: entry.patient.id },
            });
          }
        };
      case 'show-ticket':
        return () => showTicket(entry.id);
      default:
        return () => undefined;
    }
  };

  const sheetActions: SheetAction[] = ids.map((id) => ({
    label: BOARD_ACTION_LABELS[id],
    icon: ICONS[id],
    destructive: id === 'cancel',
    onPress: run(id),
  }));

  const transferTargets = doctors.filter((d) => d.id !== lane.doctor.id);
  const label = entry ? `${entry.token} ${entry.patient?.fullName ?? ''}`.trim() : '';

  return (
    <>
      <ActionSheet
        open={actionOpen && !!entry}
        onClose={closeActions}
        title={canMutate ? label : `${label} — offline`}
        actions={sheetActions}
        cancelLabel="Close"
      />
      <UrgentReasonSheet
        open={flow?.kind === 'urgent'}
        onClose={endFlow}
        tokenLabel={flowEntry?.token ?? ''}
        onSubmit={(reason) => {
          if (flowEntry) return actions.markUrgent(flowEntry, reason);
          // The entry left the queue while the sheet was open.
          toast.error(GONE);
          endFlow();
          return Promise.reject(new Error('gone'));
        }}
      />
      <ActionSheet
        open={flow?.kind === 'transfer'}
        onClose={endFlow}
        title="Transfer to doctor"
        cancelLabel="Close"
        actions={transferTargets.map((d) => ({
          label: d.fullName,
          icon: ArrowRightLeft,
          onPress: () => {
            if (flowEntry) void actions.transfer(flowEntry, d.id).catch(() => undefined);
            else toast.error(GONE);
          },
        }))}
      />
      <ConfirmDialog
        open={flow?.kind === 'cancel'}
        onClose={endFlow}
        title="Cancel this visit?"
        description="The patient leaves the queue. This cannot be undone."
        confirmLabel="Cancel visit"
        cancelLabel="Keep patient"
        destructive
        onConfirm={async () => {
          if (flowEntry) await actions.cancel(flowEntry);
          else toast.error(GONE);
        }}
      />
    </>
  );
}
