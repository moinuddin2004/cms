import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { FieldWrapper } from '@/components/shared'
import { fieldError } from '@/features/queue'
import { cn } from '@/lib/utils'
import type { useThemeForm } from '../hooks/useThemeForm'
import {
  DEFAULT_MODE_LABEL,
  SIDEBAR_STYLE_LABEL,
  THEME_KEY_LABEL,
} from '../types'
import type { DarkBase, DefaultMode, SidebarStyle, ThemeKey } from '../types'
import { BrandColorField } from './BrandColorField'
import { DarkBaseField } from './DarkBaseField'
import { LogoField } from './LogoField'

type ThemeForm = ReturnType<typeof useThemeForm>['form']

/** A small segmented control for a closed set of options. */
function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled,
  label,
}: {
  value: T
  options: Record<T, string>
  onChange: (v: T) => void
  disabled?: boolean
  label: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-lg border border-border bg-panel p-0.5"
    >
      {(Object.keys(options) as T[]).map((key) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          disabled={disabled}
          onClick={() => onChange(key)}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50',
            value === key
              ? 'bg-background text-foreground shadow-sm'
              : 'text-text-2 hover:text-foreground',
          )}
        >
          {options[key]}
        </button>
      ))}
    </div>
  )
}

/**
 * The theme fields. `lockable` lists keys that get a lock switch (locks
 * the value for the levels below); `readOnly` keys were locked above.
 */
export function ThemeControls({
  form,
  readOnly,
  lockable,
  lockLabel,
}: {
  form: ThemeForm
  readOnly: ReadonlySet<string>
  lockable: readonly ThemeKey[]
  lockLabel: string
}) {
  const row = (
    key: ThemeKey,
    control: (
      field: { value: string; set: (v: string) => void; blur: () => void },
      disabled: boolean,
    ) => ReactNode,
  ) => {
    const disabled = readOnly.has(key)
    return (
      <form.Field name={`values.${key}`}>
        {(f) => (
          <FieldWrapper
            label={THEME_KEY_LABEL[key]}
            htmlFor={`theme-${key}`}
            error={fieldError(f)}
            hint={
              disabled ? 'Locked by the platform administrator.' : undefined
            }
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                {control(
                  {
                    value: f.state.value,
                    set: (v) => f.handleChange(v as never),
                    blur: f.handleBlur,
                  },
                  disabled,
                )}
              </div>
              {lockable.includes(key) && (
                <LockSwitch form={form} name={key} label={lockLabel} />
              )}
            </div>
          </FieldWrapper>
        )}
      </form.Field>
    )
  }

  return (
    <div className="space-y-5">
      {row('app_name', (f, disabled) => (
        <Input
          id="theme-app_name"
          value={f.value}
          disabled={disabled}
          placeholder="Your clinic name"
          onChange={(e) => f.set(e.target.value)}
          onBlur={f.blur}
        />
      ))}
      {row('logo_url', (f, disabled) => (
        <LogoField
          id="theme-logo_url"
          value={f.value}
          disabled={disabled}
          onChange={f.set}
        />
      ))}
      {row('logo_dark_url', (f, disabled) => (
        <LogoField
          id="theme-logo_dark_url"
          dark
          value={f.value}
          disabled={disabled}
          onChange={f.set}
        />
      ))}
      {row('favicon_url', (f, disabled) => (
        <LogoField
          id="theme-favicon_url"
          value={f.value}
          disabled={disabled}
          onChange={f.set}
        />
      ))}
      {row('brand_color', (f, disabled) => (
        <BrandColorField
          id="theme-brand_color"
          value={f.value}
          disabled={disabled}
          onChange={f.set}
          onBlur={f.blur}
        />
      ))}
      {row('sidebar_style', (f, disabled) => (
        <Segmented<SidebarStyle>
          label="Sidebar style"
          value={f.value as SidebarStyle}
          options={SIDEBAR_STYLE_LABEL}
          disabled={disabled}
          onChange={f.set}
        />
      ))}
      {row('default_mode', (f, disabled) => (
        <Segmented<DefaultMode>
          label="Default mode"
          value={f.value as DefaultMode}
          options={DEFAULT_MODE_LABEL}
          disabled={disabled}
          onChange={f.set}
        />
      ))}
      {row('dark_base', (f, disabled) => (
        <form.Subscribe selector={(s) => s.values.values.brand_color}>
          {(brandColor) => (
            <DarkBaseField
              id="theme-dark_base"
              value={f.value as DarkBase}
              brandColor={brandColor}
              disabled={disabled}
              onChange={f.set}
            />
          )}
        </form.Subscribe>
      ))}
    </div>
  )
}

function LockSwitch({
  form,
  name,
  label,
}: {
  form: ThemeForm
  name: ThemeKey
  label: string
}) {
  return (
    <form.Field name={`locks.${name}`}>
      {(f) => (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <label className="flex shrink-0 cursor-pointer items-center gap-1.5 pt-2 text-xs text-text-3">
                <Lock className="size-3.5" />
                <Switch
                  checked={!!f.state.value}
                  onCheckedChange={(v) => f.handleChange(v)}
                  aria-label={`${label}: ${THEME_KEY_LABEL[name]}`}
                />
              </label>
            </TooltipTrigger>
            <TooltipContent className="text-xs">{label}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </form.Field>
  )
}
