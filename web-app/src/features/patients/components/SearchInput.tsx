import { useState, useEffect, useCallback } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  debounceMs?: number
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search by name or phone...',
  debounceMs = 300,
}: SearchInputProps) {
  const [localValue, setLocalValue] = useState(value)

  // Sync external value changes
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue)
      }
    }, debounceMs)
    return () => clearTimeout(timer)
  }, [localValue, debounceMs, onChange, value])

  const handleClear = useCallback(() => {
    setLocalValue('')
    onChange('')
  }, [onChange])

  return (
    <div className="relative w-full max-w-sm">
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        size={16}
      />
      <Input
        type="text"
        placeholder={placeholder}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        className="pl-9 pr-8 h-9"
        aria-label="Search patients"
        id="patient-search"
      />
      {localValue && (
        <button
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Clear search"
          type="button"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
