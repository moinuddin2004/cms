import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
}

export function SearchInput({ value, onChange }: SearchInputProps) {
  const [local, setLocal] = useState(value)

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => onChange(local), 400)
    return () => clearTimeout(timer)
  }, [local, onChange])

  // Sync external changes
  useEffect(() => {
    setLocal(value)
  }, [value])

  return (
    <div className="relative w-full flex-1 sm:min-w-[200px]">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Search name, phone, or code..."
        className="pl-10 h-8 text-xs"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        id="employee-search"
        aria-label="Search employees"
      />
    </div>
  )
}
