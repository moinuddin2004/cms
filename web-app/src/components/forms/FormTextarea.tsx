import * as React from 'react'
import { Textarea } from '@/components/ui/textarea'
import { FieldWrapper } from './FieldWrapper'

interface FormTextareaProps extends React.ComponentProps<'textarea'> {
  label?: string
  error?: React.ReactNode
  hint?: React.ReactNode
  required?: boolean
  containerClassName?: string
}

export function FormTextarea({
  label,
  error,
  hint,
  required,
  containerClassName,
  id,
  ...props
}: FormTextareaProps) {
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
      <Textarea id={inputId} aria-invalid={!!error} {...props} />
    </FieldWrapper>
  )
}
