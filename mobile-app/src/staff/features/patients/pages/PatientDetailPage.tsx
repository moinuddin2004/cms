import { isAxiosError } from 'axios';
import { Copy, MessageCircle, MoreHorizontal, Phone } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Linking, View } from 'react-native';
import { toast } from 'sonner-native';

import {
  ActionSheet,
  ErrorState,
  IconButton,
  LoadingSkeleton,
  Screen,
  ScreenHeader,
  SegmentedControl,
  type SheetAction,
} from '@/core/components';
import { queueKeys } from '@/staff/features/queue';
import { useCurrency } from '@/staff/lib/currency';
import { todayYmd } from '@/staff/lib/datetime';

import { AlertStrip } from '../components/detail/AlertStrip';
import { ChartSegment } from '../components/detail/ChartSegment';
import { OverviewSegment } from '../components/detail/OverviewSegment';
import { RxSegment } from '../components/detail/RxSegment';
import { VisitsSegment } from '../components/detail/VisitsSegment';
import { useLatestTeethChart } from '../hooks/useLatestTeethChart';
import { usePatient } from '../hooks/usePatient';
import { usePatientPrescriptions } from '../hooks/usePatientPrescriptions';
import { copyText } from '../lib/copy-text';
import { patientAlerts } from '../lib/patient-alerts';
import {
  dialCodeForCurrency,
  isPatientId,
  patientSubtitle,
  telUrl,
  visibleSegments,
  whatsappTarget,
  whatsappUrl,
  type PatientSegment,
} from '../lib/patient-detail';
import { useRecentPatientsStore } from '../store/useRecentPatientsStore';

export interface PatientDetailPageProps {
  patientId: string;
}

const SEGMENT_LABEL: Record<PatientSegment, string> = {
  overview: 'Overview',
  visits: 'Visits',
  rx: 'Rx',
  chart: 'Chart',
};

const isNotFound = (err: unknown) => isAxiosError(err) && err.response?.status === 404;

async function openUrl(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    toast('Could not open this link'); // never include the number: PHI stays out of toasts
  }
}

/**
 * S-05 patient summary (docs/06): read-only header, alert strip and segments
 * (Overview / Visits / Rx / Chart). A segment shows only when its data is
 * permitted and its feature is active; a denied block is hidden, never an error.
 */
export function PatientDetailPage({ patientId }: PatientDetailPageProps) {
  const validId = isPatientId(patientId) ? patientId : undefined;
  const patient = usePatient(validId);
  const rx = usePatientPrescriptions(validId);
  const chart = useLatestTeethChart(validId);
  const pushRecent = useRecentPatientsStore((s) => s.push);
  const queryClient = useQueryClient();
  const currency = useCurrency();
  const [pulling, setPulling] = useState(false);

  const [segment, setSegment] = useState<PatientSegment>('overview');
  const [menuOpen, setMenuOpen] = useState(false);

  const loadedId = validId ? patient.data?.id : undefined;
  useEffect(() => {
    if (loadedId) pushRecent(loadedId); // ids only, in memory (PHI rule)
  }, [loadedId, pushRecent]);

  const segments = visibleSegments({ rx: rx.access, chart: chart.access });
  const active = segments.includes(segment) ? segment : 'overview';

  const alerts = useMemo(() => (patient.data ? patientAlerts(patient.data) : []), [patient.data]);

  // Pull-to-refresh reloads the whole summary: the patient, every cached child
  // query (history, vitals, Rx, chart) and this patient's queue visits.
  const refreshAll = () => {
    setPulling(true);
    void Promise.allSettled([
      patient.refetch(),
      queryClient.invalidateQueries({
        predicate: (q) =>
          q.queryKey[0] === 'patients' &&
          q.queryKey[1] !== 'list' &&
          q.queryKey[1] !== 'check-phone' &&
          q.queryKey.includes(patientId),
      }),
      queryClient.invalidateQueries({ queryKey: queueKeys.patientVisits(patientId) }),
    ]).finally(() => setPulling(false));
  };

  if (!validId || (patient.isError && isNotFound(patient.error))) {
    return (
      <Screen header={<ScreenHeader title="Patient" />}>
        <ErrorState
          title="Not found"
          message="This patient does not exist or you cannot open it."
          className="flex-1 justify-center"
        />
      </Screen>
    );
  }

  if (patient.isPending) {
    return (
      <Screen header={<ScreenHeader title="Patient" />}>
        <LoadingSkeleton rows={4} />
      </Screen>
    );
  }

  if (patient.isError || !patient.data) {
    return (
      <Screen header={<ScreenHeader title="Patient" />}>
        <ErrorState className="flex-1 justify-center" onRetry={() => void patient.refetch()} />
      </Screen>
    );
  }

  const p = patient.data;
  const tel = telUrl(p.phone);
  const wa = whatsappUrl(whatsappTarget(p), dialCodeForCurrency(currency));
  const actions: SheetAction[] = [];
  if (tel) actions.push({ label: 'Call', icon: Phone, onPress: () => void openUrl(tel) });
  if (wa) actions.push({ label: 'WhatsApp', icon: MessageCircle, onPress: () => void openUrl(wa) });
  actions.push({
    label: 'Copy MR no.',
    icon: Copy,
    onPress: () => {
      void copyText(p.patientNumber).then((ok) =>
        toast(ok ? 'MR number copied' : 'Could not copy'),
      );
    },
  });

  return (
    <Screen
      scroll
      refreshing={pulling}
      onRefresh={refreshAll}
      header={
        <>
          <ScreenHeader
            title={p.fullName}
            subtitle={patientSubtitle(p, todayYmd())}
            backLabel="Back"
            actions={
              <IconButton
                icon={MoreHorizontal}
                accessibilityLabel="More actions"
                onPress={() => setMenuOpen(true)}
              />
            }
          />
          <AlertStrip alerts={alerts} />
          {segments.length > 1 ? (
            <View className="px-4 pb-2">
              <SegmentedControl
                segments={segments.map((s) => ({ value: s, label: SEGMENT_LABEL[s] }))}
                value={active}
                onChange={(v) => setSegment(v as PatientSegment)}
              />
            </View>
          ) : null}
        </>
      }>
      {active === 'overview' ? <OverviewSegment patient={p} /> : null}
      {active === 'visits' ? <VisitsSegment patientId={p.id} /> : null}
      {active === 'rx' ? <RxSegment rx={rx} /> : null}
      {active === 'chart' ? <ChartSegment chart={chart} /> : null}
      <ActionSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={p.fullName}
        actions={actions}
        cancelLabel="Cancel"
      />
    </Screen>
  );
}
