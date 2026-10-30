import { fieldError } from '@/components/forms/fieldError'

interface ListFieldLike {
  state: { meta: { errors: unknown[]; isTouched: boolean } }
  form: { state: { submissionAttempts: number; isDirty: boolean } }
}

/**
 * Error for an array field ("Add at least one item"). Rows are added through
 * pickers rather than typed, so the list itself is rarely "touched" — show the
 * message once the form has been changed at all, not just after a submit.
 */
export function listError(field: ListFieldLike): string | undefined {
  const own = fieldError(field)
  if (own || !field.form.state.isDirty) return own
  const first = field.state.meta.errors[0] as
    string | { message?: string } | undefined
  return typeof first === 'string' ? first : first?.message
}
