import { SearchX } from 'lucide-react-native';

import { EmptyState } from './EmptyState';

/** Filters/search matched nothing — different from an empty list. */
export function NoResultsState({ onClear }: { onClear?: () => void }) {
  return (
    <EmptyState
      icon={SearchX}
      title="No results for your filters"
      description="Try a different search or clear the filters."
      actionLabel={onClear ? 'Clear all filters' : undefined}
      onAction={onClear}
    />
  );
}
