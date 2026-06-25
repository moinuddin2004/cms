import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Search, UserPlus, AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import api from '@/lib/api'
import { useDoctors } from '../hooks/useDoctors'
import { useCreateWalkIn } from '../hooks/useCreateWalkIn'
import { formatToken, type WalkInFormData } from '../types'

interface PatientLite {
  id: string
  fullName: string
  phone: string
  patientNumber?: string
}

export function WalkInDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: doctors = [] } = useDoctors()
  const createWalkIn = useCreateWalkIn()

  // mode: pick an existing patient, or quick-create a new one
  const [mode, setMode] = useState<'search' | 'new'>('search')
  const [picked, setPicked] = useState<PatientLite | null>(null)

  // search state
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PatientLite[]>([])
  const [searching, setSearching] = useState(false)

  // new-patient state
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')

  // shared fields
  const [doctorId, setDoctorId] = useState<string>('')
  const [reason, setReason] = useState('')

  // duplicate-active warning → allow forcing
  const [dupWarning, setDupWarning] = useState<string | null>(null)

  // reset everything whenever the dialog (re)opens
  useEffect(() => {
    if (!open) return
    setMode('search')
    setPicked(null)
    setQuery('')
    setResults([])
    setNewName('')
    setNewPhone('')
    setDoctorId('')
    setReason('')
    setDupWarning(null)
  }, [open])

  // debounced patient search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    const t = setTimeout(async () => {
      try {
        setSearching(true)
        const { data } = await api.get('/patients', {
          params: { search: query, limit: 8 },
        })
        const list = data?.data?.data || data?.data || []
        setResults(
          list.map((p: any) => ({
            id: p.id,
            fullName: p.fullName,
            phone: p.phone,
            patientNumber: p.patientNumber,
          })),
        )
      } catch {
        // ignore
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  const submit = async (force = false) => {
    const payload: WalkInFormData = {
      doctorId: doctorId || undefined,
      reasonForVisit: reason.trim() || undefined,
      force,
    }
    if (mode === 'search') {
      if (!picked) {
        toast.error('Pick a patient or switch to "New patient"')
        return
      }
      payload.patientId = picked.id
    } else {
      if (!newName.trim() || !newPhone.trim()) {
        toast.error('Name and phone are required')
        return
      }
      payload.patientName = newName.trim()
      payload.patientPhone = newPhone.trim()
    }

    try {
      const appt = await createWalkIn.mutateAsync(payload)
      toast.success(`Token ${formatToken(appt)} assigned`, {
        description: appt.patient?.fullName ?? undefined,
      })
      onOpenChange(false)
    } catch (e: any) {
      const data = e?.response?.data
      if (data?.code === 'DUPLICATE_ACTIVE_APPOINTMENT' || /already has an active token/i.test(data?.message ?? '')) {
        setDupWarning(data?.message ?? 'Patient already has an active token today.')
        return
      }
      toast.error(data?.message || 'Failed to add walk-in')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add walk-in</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Mode toggle */}
          <div className="flex border rounded-lg overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setMode('search')}
              className={
                mode === 'search'
                  ? 'flex-1 px-3 py-2 bg-primary text-primary-foreground font-medium'
                  : 'flex-1 px-3 py-2 bg-card text-muted-foreground hover:bg-accent'
              }
            >
              <Search className="inline h-3.5 w-3.5 mr-1.5" />
              Existing patient
            </button>
            <button
              type="button"
              onClick={() => setMode('new')}
              className={
                mode === 'new'
                  ? 'flex-1 px-3 py-2 bg-primary text-primary-foreground font-medium'
                  : 'flex-1 px-3 py-2 bg-card text-muted-foreground hover:bg-accent'
              }
            >
              <UserPlus className="inline h-3.5 w-3.5 mr-1.5" />
              New patient
            </button>
          </div>

          {mode === 'search' ? (
            picked ? (
              <div className="flex items-center justify-between border rounded-lg p-3 bg-muted/30">
                <div>
                  <p className="font-semibold text-sm">{picked.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {picked.patientNumber ?? ''} · {picked.phone}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name or phone…"
                  className="pl-9 h-9"
                  autoFocus
                />
                {query.trim().length >= 2 && (
                  <div className="absolute z-20 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {searching && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        Searching…
                      </div>
                    )}
                    {!searching && results.length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        No patients found — use "New patient".
                      </div>
                    )}
                    {results.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setPicked(p)
                          setQuery('')
                          setResults([])
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                      >
                        <p className="font-medium">{p.fullName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {p.patientNumber} · {p.phone}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          ) : (
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label className="text-xs">Patient name *</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Full name"
                  className="h-9 mt-1"
                  autoFocus
                />
              </div>
              <div>
                <Label className="text-xs">Phone *</Label>
                <Input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="03xx-xxxxxxx"
                  className="h-9 mt-1"
                />
              </div>
            </div>
          )}

          {/* Doctor (optional) */}
          <div>
            <Label className="text-xs">Doctor (optional)</Label>
            <Select value={doctorId} onValueChange={setDoctorId}>
              <SelectTrigger className="h-9 mt-1">
                <SelectValue placeholder="Assign later / any doctor" />
              </SelectTrigger>
              <SelectContent>
                {doctors.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    Dr. {d.fullName}
                    {d.designation ? ` · ${d.designation}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reason */}
          <div>
            <Label className="text-xs">Reason for visit (optional)</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Fever, tooth pain…"
              className="h-9 mt-1"
            />
          </div>

          {dupWarning && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p>{dupWarning}</p>
                <p className="mt-1 text-amber-700">
                  Add another token for the same patient anyway?
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createWalkIn.isPending}
          >
            Cancel
          </Button>
          {dupWarning ? (
            <Button
              onClick={() => submit(true)}
              disabled={createWalkIn.isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {createWalkIn.isPending && (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              )}
              Add anyway
            </Button>
          ) : (
            <Button onClick={() => submit(false)} disabled={createWalkIn.isPending}>
              {createWalkIn.isPending && (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              )}
              Add to queue
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
