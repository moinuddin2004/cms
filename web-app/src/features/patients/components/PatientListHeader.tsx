import { Button } from '@/components/ui/button'
import { LayoutGrid, Table2, Plus, Users } from 'lucide-react'
import { usePatientStore } from '@/store/patient-store'
import { cn } from '@/lib/utils'

interface PatientListHeaderProps {
  totalCount: number
  onNewPatient: () => void
}

export function PatientListHeader({ totalCount, onNewPatient }: PatientListHeaderProps) {
  const { viewMode, setViewMode } = usePatientStore()

  return (
    <div className="flex items-center justify-between flex-wrap gap-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-brand-100 rounded-lg">
          <Users size={20} className="text-brand-700" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Patients</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount} patient{totalCount !== 1 ? 's' : ''} total
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* View Toggle */}
        <div className="flex items-center border border-border rounded-lg overflow-hidden">
          <ToggleButton
            active={viewMode === 'table'}
            onClick={() => setViewMode('table')}
            icon={<Table2 size={16} />}
            label="Table view"
          />
          <ToggleButton
            active={viewMode === 'card'}
            onClick={() => setViewMode('card')}
            icon={<LayoutGrid size={16} />}
            label="Card view"
          />
        </div>

        {/* New Patient Button */}
        <Button onClick={onNewPatient} id="new-patient-btn">
          <Plus size={16} className="mr-1.5" />
          New Patient
        </Button>
      </div>
    </div>
  )
}

function ToggleButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'p-2 transition-colors',
        active
          ? 'bg-brand-600 text-white'
          : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted',
      )}
      aria-label={label}
      type="button"
    >
      {icon}
    </button>
  )
}
