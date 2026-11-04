/** Kinds of record the global quick search (Ctrl+K) can return. */
export type SearchType = 'patients';

export const SEARCH_TYPES: readonly SearchType[] = ['patients'];

export interface SearchItem {
  id: string;
  type: SearchType;
  title: string;
  /** Second line under the title (MR# · phone …). */
  subtitle: string | null;
  /** Front-end route the result opens. */
  href: string;
  /** Short labels such as "Inactive". */
  badges: string[];
}

export interface SearchGroup {
  type: SearchType;
  items: SearchItem[];
  /** More matches exist than were returned. */
  hasMore: boolean;
}

export interface SearchResponse {
  query: string;
  groups: SearchGroup[];
}
