import type { ReactNode } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FieldWrapper } from './FieldWrapper'

export interface SelectOption {
  value: string
  label: string
}

interface FormSelectProps {
  label?: string
  error?: ReactNode
  hint?: ReactNode
  required?: boolean
  placeholder?: string
  value: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  disabled?: boolean
  containerClassName?: string
  className?: string
}

/** Controlled select + label/error wrapper. */
export function FormSelect({
  label,
  error,
  hint,
  required,
  placeholder = 'Select',
  value,
  onValueChange,
  options,
  disabled,
  containerClassName,
  className,
}: FormSelectProps) {
  const inputId = label ? `f-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined
  return (
    <FieldWrapper
      label={label}
      htmlFor={inputId}
      required={required}
      error={error}
      hint={hint}
      className={containerClassName}
    >
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger
          id={inputId}
          aria-invalid={!!error}
          className={className ?? 'w-full'}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldWrapper>
  )
}
