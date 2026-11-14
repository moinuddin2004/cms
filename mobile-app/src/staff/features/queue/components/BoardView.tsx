import { LayoutList } from 'lucide-react-native';

import { EmptyState } from '@/core/components';

/**
 * S-02b reception board (docs/06). Skeleton placed by the team lead so M1-08
 * and M1-09 can run in parallel: **M1-09 replaces this file's body**; the
 * queue tab page (`pages/QueueTabPage.tsx`) already renders it.
 */
export function BoardView() {
  return (
    <EmptyState
      icon={LayoutList}
      title="Queue board"
      description="This view is being built."
      className="flex-1 justify-center"
    />
  );
}
