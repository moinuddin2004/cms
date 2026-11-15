import type { ReactNode } from 'react';
import { View } from 'react-native';

import { ErrorState } from '@/core/components';
import { Skeleton } from '@/core/ui/skeleton';

import type { GatedQuery } from '../hooks/gated-query';

interface BlockShellProps<T> {
  gated: GatedQuery<T>;
  /** Shown while the first answer is on its way. */
  skeleton?: ReactNode;
  errorTitle: string;
  children: (data: T) => ReactNode;
}

const DEFAULT_SKELETON = (
  <View className="gap-3 px-4">
    <Skeleton className="h-16 w-full rounded-xl" />
  </View>
);

/**
 * One Today block's own loading / error / data states. A denied block renders
 * nothing (the page already hides it); an error offers its own retry so one
 * failing block never blanks the others.
 */
export function BlockShell<T>({
  gated,
  skeleton = DEFAULT_SKELETON,
  errorTitle,
  children,
}: BlockShellProps<T>) {
  if (gated.access === 'denied') return null;
  if (gated.access === 'loading') return <>{skeleton}</>;
  const { query } = gated;
  if (query.data !== undefined) return <>{children(query.data)}</>;
  if (query.isError) {
    return <ErrorState title={errorTitle} onRetry={() => void query.refetch()} className="py-6" />;
  }
  return <>{skeleton}</>;
}
