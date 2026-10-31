import { Search, X } from 'lucide-react'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export function SettingsSearch({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-3" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onChange('')
        }}
        placeholder="Search settings"
        aria-label="Search settings"
        className="h-9 pl-9 pr-8 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <TooltipButton
          tooltip="Clear search"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 size-7 -translate-y-1/2 text-text-3"
          onClick={() => onChange('')}
        >
          <X className="size-3.5" />
        </TooltipButton>
      )}
    </div>
  )
}
