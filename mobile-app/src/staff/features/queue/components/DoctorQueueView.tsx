import { Stethoscope } from 'lucide-react-native';

import { EmptyState } from '@/core/components';

/**
 * S-02a doctor view (docs/06). Skeleton placed by the team lead so M1-08 and
 * M1-09 can run in parallel: **M1-08 replaces this file's body**; the queue
 * tab page (`pages/QueueTabPage.tsx`) already renders it.
 */
export function DoctorQueueView() {
  return (
    <EmptyState
      icon={Stethoscope}
      title="My queue"
      description="This view is being built."
      className="flex-1 justify-center"
    />
  );
}
