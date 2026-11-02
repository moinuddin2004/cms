import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldWrapper } from '@/components/forms/FieldWrapper'

export function VitalInput({
  label,
  value,
  onChange,
  onBlur,
  error,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  onBlur: () => void
  error?: string
  placeholder?: string
}) {
  return (
    <div>
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <FieldWrapper error={error} className="mt-0.5">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={!!error}
          className="h-8 text-xs"
          placeholder={placeholder}
        />
      </FieldWrapper>
    </div>
  )
}
