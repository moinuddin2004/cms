import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/** A combobox-lite: type free text or pick from presets. */
export function FreeSelect({
  value,
  onChange,
  onBlur,
  options,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  options: string[]
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={onBlur}
        className="h-8 text-xs"
        placeholder={placeholder}
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto bg-popover border rounded-md shadow-lg">
          {options.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => {
                onChange(o)
                setOpen(false)
              }}
              className={cn(
                'w-full text-left px-3 py-1.5 text-xs hover:bg-accent',
                o === value && 'bg-accent',
              )}
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
