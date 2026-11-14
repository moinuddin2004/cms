import { UserRound } from 'lucide-react-native';

import { EmptyState, Screen, ScreenHeader } from '@/core/components';

export interface PatientDetailPageProps {
  patientId: string;
}

/**
 * S-05 patient summary (docs/06). Skeleton placed by the team lead so the
 * patients list (M1-11) can link here while the summary (M1-12) is built in
 * parallel: **M1-12 replaces this file's body**.
 */
export function PatientDetailPage({ patientId }: PatientDetailPageProps) {
  return (
    <Screen header={<ScreenHeader title="Patient" />}>
      <EmptyState
        icon={UserRound}
        title="Patient details"
        description={`This screen is being built (${patientId.slice(0, 8)}).`}
        className="flex-1 justify-center"
      />
    </Screen>
  );
}
