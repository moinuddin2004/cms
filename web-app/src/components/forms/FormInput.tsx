import * as React from 'react'
import { Input } from '@/components/ui/input'
import { FieldWrapper } from './FieldWrapper'

interface FormInputProps extends React.ComponentProps<'input'> {
  label?: string
  error?: React.ReactNode
  hint?: React.ReactNode
  required?: boolean
  containerClassName?: string
}

/**
 * Controlled input + label/error wrapper. Works with TanStack Form fields:
 *   <FormInput label="Name" value={field.state.value}
 *     onChange={(e) => field.handleChange(e.target.value)}
 *     onBlur={field.handleBlur} error={fieldError(field)} />
 */
export function FormInput({
  label,
  error,
  hint,
  required,
  containerClassName,
  id,
  ...props
}: FormInputProps) {
  const inputId =
    id ?? (label ? `f-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined)
  return (
    <FieldWrapper
      label={label}
      htmlFor={inputId}
      required={required}
      error={error}
      hint={hint}
      className={containerClassName}
    >
      <Input id={inputId} aria-invalid={!!error} {...props} />
    </FieldWrapper>
  )
}
