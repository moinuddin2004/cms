/**
 * Shared field/button styling for the auth screens, so login, registration
 * and password recovery stay visually identical.
 */
export const authLabelClass =
  'mb-1.5 block text-[12.5px] font-medium tracking-[-0.005em] text-foreground'

export const authInputClass =
  'h-10 rounded-xl border-border bg-surface px-3.5 text-[14px] shadow-none transition-colors placeholder:text-text-3 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25'

export const authInputWithActionClass = `${authInputClass} pr-11`

export const authSubmitClass =
  'h-10 w-full rounded-xl text-[14px] font-semibold active:scale-[0.99]'

export const authTextLinkClass =
  'font-semibold text-primary-text underline-offset-4 hover:underline'

export const authAltClass =
  'mt-5 text-center text-[13px] leading-relaxed text-muted-foreground'
