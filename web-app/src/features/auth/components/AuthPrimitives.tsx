import type { ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'

export function AuthHeading({
  title,
  subtitle,
}: {
  title: string
  subtitle: ReactNode
}) {
  return (
    <div className="mb-7">
      <h1 className="text-[26px] font-semibold leading-[1.15] tracking-[-0.025em] text-foreground">
        {title}
      </h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
        {subtitle}
      </p>
    </div>
  )
}

export function AuthError({ message }: { message: string }) {
  if (!message) return null

  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/10 px-3.5 py-3 text-[13px] leading-snug font-medium text-destructive"
    >
      <AlertCircle className="mt-px size-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}
