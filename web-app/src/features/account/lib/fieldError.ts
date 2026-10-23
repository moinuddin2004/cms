interface FieldLike {
  state: { meta: { errors: unknown[]; isTouched: boolean } }
  form: { state: { submissionAttempts: number } }
}

/**
 * First validation message of a TanStack Form field, for FieldWrapper's
 * `error` prop — only once the field was touched or a submit was attempted,
 * so a fresh form doesn't open covered in red.
 */
export function fieldError(field: FieldLike): string | undefined {
  const { errors, isTouched } = field.state.meta
  if (!errors.length) return undefined
  if (!isTouched && field.form.state.submissionAttempts === 0) return undefined
  const first = errors[0] as string | { message?: string } | undefined
  return typeof first === 'string' ? first : first?.message
}
