import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/forms/NumberInput'
import { Switch } from '@/components/ui/switch'
import { FieldWrapper, FormSelect } from '@/components/shared'
import { MultiSelect } from '@/components/shared/MultiSelect'
import type { FormField } from '../types'

/** Field types a template can pre-fill; teeth, dates and files are per order. */
const PREFILLABLE = new Set<FormField['type']>([
  'select',
  'multiselect',
  'text',
  'textarea',
  'number',
  'boolean',
])

const NONE = '__none__'

function isVisible(field: FormField, answers: Record<string, unknown>) {
  if (!field.visibleIf) return true
  const other = answers[field.visibleIf.field]
  if (other === undefined || other === '') return false
  const values = Array.isArray(other) ? other : [other]
  return field.visibleIf.in.some((v) => values.includes(v))
}

/**
 * Pre-fill answers for one template line, from the service's order form.
 * Everything is optional here; the server checks the answers against the
 * form and the doctor completes the rest when ordering.
 */
export function TemplateAnswerFields({
  idPrefix,
  fields,
  value,
  onChange,
}: {
  idPrefix: string
  fields: FormField[]
  value: Record<string, unknown>
  onChange: (value: Record<string, unknown>) => void
}) {
  const set = (key: string, v: unknown) => {
    const next = { ...value }
    if (v === '' || v === undefined || (Array.isArray(v) && !v.length)) {
      delete next[key]
    } else {
      next[key] = v
    }
    onChange(next)
  }
  const shown = fields.filter(
    (f) => PREFILLABLE.has(f.type) && isVisible(f, value),
  )
  if (!shown.length) {
    return (
      <p className="text-xs text-text-3">
        Nothing to pre-fill — teeth and files are added when ordering.
      </p>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {shown.map((f) => {
        const id = `${idPrefix}-${f.key}`
        const current = value[f.key]
        switch (f.type) {
          case 'select':
            return (
              <FormSelect
                key={f.key}
                label={f.label}
                value={typeof current === 'string' ? current : NONE}
                onValueChange={(v) => set(f.key, v === NONE ? '' : v)}
                options={[
                  { value: NONE, label: 'Choose when ordering' },
                  ...(f.options ?? []),
                ]}
              />
            )
          case 'multiselect':
            return (
              <FieldWrapper key={f.key} label={f.label} htmlFor={id}>
                <MultiSelect
                  id={id}
                  aria-label={f.label}
                  options={f.options ?? []}
                  value={Array.isArray(current) ? (current as string[]) : []}
                  onChange={(v) => set(f.key, v)}
                />
              </FieldWrapper>
            )
          case 'boolean':
            return (
              <FieldWrapper key={f.key} label={f.label} htmlFor={id}>
                <Switch
                  id={id}
                  checked={current === true}
                  onCheckedChange={(on) => set(f.key, on ? true : undefined)}
                />
              </FieldWrapper>
            )
          case 'number':
            return (
              <FieldWrapper key={f.key} label={f.label} htmlFor={id}>
                <NumberInput
                  id={id}
                  decimals={6}
                  value={typeof current === 'number' ? String(current) : ''}
                  onChange={(e) =>
                    set(
                      f.key,
                      e.target.value.trim() === ''
                        ? ''
                        : Number(e.target.value),
                    )
                  }
                />
              </FieldWrapper>
            )
          default:
            return (
              <FieldWrapper key={f.key} label={f.label} htmlFor={id}>
                <Input
                  id={id}
                  value={typeof current === 'string' ? current : ''}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              </FieldWrapper>
            )
        }
      })}
    </div>
  )
}
