import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface FieldWrapperProps {
  label?: string
  htmlFor?: string
  required?: boolean
  error?: ReactNode
  hint?: ReactNode
  className?: string
  children: ReactNode
}

/** Label + control + error wrapper used by every form field. */
export function FieldWrapper({
  label,
  htmlFor,
  required,
  error,
  hint,
  className,
  children,
}: FieldWrapperProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <Label
          htmlFor={htmlFor}
          className="text-[13px] font-semibold text-foreground"
        >
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </Label>
      )}
      {children}
      {error ? (
        <p className="text-xs font-medium text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-text-3">{hint}</p>
      ) : null}
    </div>
  )
}
