import type { PrescriptionListItem } from '../types/patients.types';

/**
 * Finalized and amended prescriptions first, drafts after (drafts are shown, not hidden).
 * Stable: the server order (newest first) is kept inside each group.
 */
export function sortPrescriptions(items: PrescriptionListItem[]): PrescriptionListItem[] {
  const rank = (p: PrescriptionListItem) => (p.status === 'DRAFT' ? 1 : 0);
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => rank(a.item) - rank(b.item) || a.index - b.index)
    .map(({ item }) => item);
}
