import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/forms/NumberInput'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { FieldWrapper } from '@/components/shared'
import { DatePicker } from '@/components/shared/DatePicker'
import { MultiSelect } from '@/components/shared/MultiSelect'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { sectionsFor, visibleKeys } from '../lib/form-preview'
import type { FieldDef } from '../types'
import { ToothChartInput } from './ToothChartInput'

/**
 * Renders a form schema version's fields — one input per field type, in
 * `ui_json` sections, hiding fields whose `visibleIf` does not match. Used
 * by the Studio preview and by order forms, so both render identically.
 * Answers are controlled by the caller; `resetKey` remounts inputs that
 * keep their own text state (numbers) after a reset. `renderFile` replaces
 * the Studio's placeholder file box with a real uploader (order forms).
 */
export function DynamicFormFields({
  fields,
  ui,
  answers,
  onChange,
  errorFor,
  resetKey = 0,
  renderFile,
}: {
  fields: FieldDef[]
  ui: unknown
  answers: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
  errorFor?: (key: string) => string | undefined
  resetKey?: number
  renderFile?: RenderFile
}) {
  const shown = useMemo(() => visibleKeys(fields, answers), [fields, answers])
  const sections = useMemo(() => sectionsFor(fields, ui), [fields, ui])
  return (
    <>
      {sections.map((s, i) => {
        const visible = s.fields.filter((f) => shown.has(f.key))
        if (!visible.length) return null
        return (
          <fieldset key={`${s.title}-${i}`} className="space-y-4">
            {s.title && (
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-3">
                {s.title}
              </legend>
            )}
            {visible.map((f) => (
              <PreviewField
                key={`${f.key}-${resetKey}`}
                field={f}
                value={answers[f.key]}
                onChange={(v) => onChange(f.key, v)}
                error={errorFor?.(f.key)}
                renderFile={renderFile}
              />
            ))}
          </fieldset>
        )
      })}
    </>
  )
}

export type RenderFile = (
  field: FieldDef,
  value: unknown,
  onChange: (value: unknown) => void,
) => ReactNode

function PreviewField({
  field,
  value,
  onChange,
  error,
  renderFile,
}: {
  field: FieldDef
  value: unknown
  onChange: (value: unknown) => void
  error?: string
  renderFile?: RenderFile
}) {
  const id = `preview-${field.key}`
  const options = (field.options ?? []).filter(
    (o) => typeof o.value === 'string' && o.value !== '',
  )
  const text = typeof value === 'string' ? value : ''

  let control
  switch (field.type) {
    case 'tooth_chart':
      control = (
        <ToothChartInput field={field} value={value} onChange={onChange} />
      )
      break
    case 'select':
      control = (
        <Select
          value={typeof value === 'string' ? value : ''}
          onValueChange={onChange}
        >
          <SelectTrigger id={id} className="w-full" aria-label={field.label}>
            <SelectValue placeholder="Choose…" />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label || o.value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
      break
    case 'multi_select':
      control = (
        <MultiSelect
          id={id}
          aria-label={field.label}
          options={options.map((o) => ({
            value: o.value,
            label: o.label || o.value,
          }))}
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={onChange}
        />
      )
      break
    case 'textarea':
      control = (
        <Textarea
          id={id}
          rows={3}
          value={text}
          maxLength={field.maxLength}
          onChange={(e) => onChange(e.target.value)}
        />
      )
      break
    case 'number':
      control = <NumberField id={id} field={field} onChange={onChange} />
      break
    case 'date':
      control = (
        <DatePicker
          id={id}
          value={text || undefined}
          onChange={onChange}
          clearable={!field.required}
        />
      )
      break
    case 'boolean':
      control = (
        <div className="flex items-center gap-2">
          <Switch
            id={id}
            checked={value === true}
            onCheckedChange={onChange}
            aria-label={field.label}
          />
          <span className="text-sm text-text-2">
            {value === true ? 'Yes' : value === false ? 'No' : 'Not answered'}
          </span>
        </div>
      )
      break
    case 'file': {
      if (renderFile) {
        control = renderFile(field, value, onChange)
        break
      }
      const files = Array.isArray(value) ? (value as string[]) : []
      control = (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border p-3 text-sm text-text-3">
          <Paperclip className="size-4" />
          <span>
            {files.length
              ? `${files.length} placeholder file${files.length === 1 ? '' : 's'}`
              : 'Files are uploaded with the order'}
            {field.accept?.length ? ` · ${field.accept.join(', ')}` : ''}
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onChange([...files, crypto.randomUUID()])}
          >
            Add placeholder
          </Button>
          {files.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onChange([])}
            >
              Clear
            </Button>
          )}
        </div>
      )
      break
    }
    default:
      control = (
        <Input
          id={id}
          value={text}
          maxLength={field.maxLength}
          onChange={(e) => onChange(e.target.value)}
        />
      )
  }

  return (
    <FieldWrapper
      label={field.label || field.key}
      htmlFor={id}
      required={field.required}
      error={error}
      hint={field.help}
    >
      {control}
    </FieldWrapper>
  )
}

/** Keeps the typed text (e.g. "1.") while sending a number. */
function NumberField({
  id,
  field,
  onChange,
}: {
  id: string
  field: FieldDef
  onChange: (value: unknown) => void
}) {
  const [text, setText] = useState(
    typeof field.defaultValue === 'number' ? String(field.defaultValue) : '',
  )
  return (
    <div className="flex items-center gap-2">
      <NumberInput
        id={id}
        mode={field.decimals === 0 ? 'integer' : 'decimal'}
        decimals={field.decimals ?? 6}
        allowNegative={(field.min ?? -1) < 0}
        value={text}
        onChange={(e) => {
          const v = e.target.value
          setText(v)
          const n = Number(v)
          onChange(v.trim() === '' ? undefined : Number.isFinite(n) ? n : v)
        }}
      />
      {field.unit && <span className="text-sm text-text-3">{field.unit}</span>}
    </div>
  )
}
