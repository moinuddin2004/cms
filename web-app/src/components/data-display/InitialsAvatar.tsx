import { cn } from '@/lib/utils'

const TONES = [
  'bg-primary-soft text-primary-text',
  'bg-emerald-soft text-emerald',
  'bg-amber-soft text-amber',
  'bg-violet-soft text-violet',
]

const SIZES = {
  sm: 'size-8 text-[11px]',
  md: 'size-[42px] text-sm',
  lg: 'size-16 rounded-2xl text-[22px]',
} as const

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function toneFor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return TONES[h % TONES.length]
}

interface InitialsAvatarProps {
  name: string
  /** Stable seed for color rotation (defaults to name). */
  seed?: string
  size?: keyof typeof SIZES
  className?: string
}

/** Circular initials avatar with a color rotated deterministically from the name. */
export function InitialsAvatar({
  name,
  seed,
  size = 'md',
  className,
}: InitialsAvatarProps) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-bold',
        SIZES[size],
        toneFor(seed ?? name),
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}
