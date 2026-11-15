import { FlashList } from '@shopify/flash-list';
import { Inbox, SearchX } from 'lucide-react-native';
import { useState, type ReactElement } from 'react';
import { View } from 'react-native';

import { EmptyState, ErrorState, LoadingSkeleton, Spinner } from '@/core/components';
import { useT } from '@/core/i18n';
import { Button } from '@/core/ui/button';
import { Text } from '@/core/ui/text';

export interface RecordsListProps<T> {
  items: T[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onRefresh: () => Promise<unknown> | void;
  emptyTitle: string;
  emptyBody: string;
  /** A search is active: an empty result is "no results", not "empty". */
  filtered: boolean;
  onClearFilters: () => void;
  renderItem: (item: T) => ReactElement;
  keyOf: (item: T) => string;
  onEndReached?: () => void;
  loadingMore?: boolean;
  /** Loading the next page failed: show a retry footer instead of retrying on scroll. */
  nextPageFailed?: boolean;
  onRetryNextPage?: () => void;
}

/** One segment's list with all four states: loading, empty, error (retry), no results. */
export function RecordsList<T>({
  items,
  isLoading,
  isError,
  onRetry,
  onRefresh,
  emptyTitle,
  emptyBody,
  filtered,
  onClearFilters,
  renderItem,
  keyOf,
  onEndReached,
  loadingMore,
  nextPageFailed,
  onRetryNextPage,
}: RecordsListProps<T>) {
  const { t } = useT();
  // Only a user pull spins the control, not background refetches.
  const [pulling, setPulling] = useState(false);

  if (isLoading) return <LoadingSkeleton />;
  if (isError && items.length === 0) {
    return (
      <ErrorState
        title={t('records.error')}
        message={t('records.errorBody')}
        retryLabel={t('common.retry')}
        onRetry={onRetry}
      />
    );
  }
  if (items.length === 0) {
    return filtered ? (
      <EmptyState
        icon={SearchX}
        title={t('records.noResults')}
        description={t('records.noResultsBody')}
        actionLabel={t('records.clearAll')}
        onAction={onClearFilters}
      />
    ) : (
      <EmptyState icon={Inbox} title={emptyTitle} description={emptyBody} />
    );
  }

  return (
    <FlashList
      data={items}
      keyExtractor={keyOf}
      renderItem={({ item }) => renderItem(item)}
      ItemSeparatorComponent={() => <View className="h-3" />}
      contentContainerClassName="px-4 pb-6 pt-2"
      refreshing={pulling}
      onRefresh={() => {
        setPulling(true);
        void Promise.resolve(onRefresh()).finally(() => setPulling(false));
      }}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        nextPageFailed ? (
          <View className="items-center gap-2 py-4">
            <Text variant="muted">{t('records.moreFailed')}</Text>
            <Button variant="outline" onPress={onRetryNextPage}>
              <Text>{t('common.retry')}</Text>
            </Button>
          </View>
        ) : loadingMore ? (
          <Spinner />
        ) : null
      }
    />
  );
}
