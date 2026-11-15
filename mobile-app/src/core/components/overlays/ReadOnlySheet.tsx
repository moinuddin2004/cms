import type { ReactNode } from 'react';

import { FormSheet, type FormSheetProps } from './FormSheet';

// A read-only sheet is never dirty, so the discard confirmation can never open.
const NEVER_SHOWN = { title: '', description: '', confirmLabel: '', cancelLabel: '' };

export type ReadOnlySheetProps = Pick<
  FormSheetProps,
  'open' | 'onClose' | 'title' | 'closeLabel' | 'submit' | 'error'
> & { children: ReactNode };

/**
 * Bottom sheet for showing a record (docs/05 §7): same chrome as `FormSheet` (dynamic
 * height, drag handle, close button, optional sticky action) without any form or
 * "discard changes?" machinery. `submit` is just the optional primary action.
 */
export function ReadOnlySheet(props: ReadOnlySheetProps) {
  return <FormSheet {...props} discard={NEVER_SHOWN} />;
}
