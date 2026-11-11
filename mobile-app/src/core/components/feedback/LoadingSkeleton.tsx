import { View } from 'react-native';

import { Skeleton } from '@/core/ui/skeleton';
import { cn } from '@/core/utils';

/** List placeholder — never show a blank screen while loading. */
export function LoadingSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <View className={cn('gap-3 p-4', className)}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} className="flex-row items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <View className="flex-1 gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </View>
        </View>
      ))}
    </View>
  );
}
