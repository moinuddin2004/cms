import type { ReactNode } from 'react';
import { View } from 'react-native';

import { ErrorState, LoadingSkeleton } from '@/core/components';
import { Text } from '@/core/ui/text';

/** A titled card on the patient summary. */
export function DetailBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="border-border bg-card gap-2 rounded-lg border p-4">
      <Text variant="small" accessibilityRole="header" className="text-muted-foreground uppercase">
        {title}
      </Text>
      {children}
    </View>
  );
}

/** One label + value pair; a missing value is omitted by the caller. */
export function Field({ label, value }: { label: string; value: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} className="gap-0.5">
      <Text variant="muted">{label}</Text>
      <Text>{value}</Text>
    </View>
  );
}

/** Loading / error / empty / content for one query-backed block. */
export function QueryBlock({
  isPending,
  isError,
  onRetry,
  empty,
  emptyText,
  children,
}: {
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  empty: boolean;
  emptyText: string;
  children: ReactNode;
}) {
  if (isPending) return <LoadingSkeleton rows={2} className="p-0" />;
  if (isError) return <ErrorState className="py-6" onRetry={onRetry} />;
  if (empty) return <Text variant="muted">{emptyText}</Text>;
  return <>{children}</>;
}
