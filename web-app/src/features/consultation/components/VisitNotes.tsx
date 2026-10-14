import { addDays, format } from 'date-fns'
import { ClipboardList } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { DatePicker } from '@/components/shared/DatePicker'
import type { SaveState, VisitNotes as VisitNotesValue } from '../types'
import {
  ADVICE_PICKS,
  COMPLAINT_PICKS,
  DIAGNOSIS_PICKS,
  FOLLOW_UP_PICKS,
  appendPhrase,
} from '../constants/quickPicks'
import { Chip } from './Chip'
import { SaveBadge } from './SaveBadge'

type NoteField = Exclude<keyof VisitNotesValue, 'followUpDate'>

/**
 * The visit notes. Everything auto-saves; common phrases are one tap each so
 * the doctor rarely needs the keyboard.
 */
export function VisitNotes({
  value,
  onChange,
  saveState,
  savedAt,
}: {
  value: VisitNotesValue
  onChange: (next: VisitNotesValue) => void
  saveState: SaveState
  savedAt: Date | null
}) {
  const set = (field: keyof VisitNotesValue, text: string) =>
    onChange({ ...value, [field]: text })
  const pick = (field: NoteField, phrase: string) =>
    set(field, appendPhrase(value[field], phrase))

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <ClipboardList className="size-4 text-primary-text" />
          Visit notes
        </h2>
        <SaveBadge state={saveState} savedAt={savedAt} />
      </div>

      <div className="space-y-5">
        <NoteBlock
          label="Complaint"
          value={value.chiefComplaint}
          placeholder="Why did the patient come?"
          picks={COMPLAINT_PICKS}
          onText={(t) => set('chiefComplaint', t)}
          onPick={(p) => pick('chiefComplaint', p)}
        />
        <NoteBlock
          label="Examination"
          value={value.examination}
          placeholder="Findings — tooth numbers, gums, X-ray…"
          onText={(t) => set('examination', t)}
        />
        <NoteBlock
          label="Diagnosis"
          value={value.diagnosis}
          placeholder="Diagnosis"
          picks={DIAGNOSIS_PICKS}
          onText={(t) => set('diagnosis', t)}
          onPick={(p) => pick('diagnosis', p)}
        />
        <NoteBlock
          label="Advice to patient"
          value={value.advice}
          placeholder="Instructions for the patient"
          picks={ADVICE_PICKS}
          onText={(t) => set('advice', t)}
          onPick={(p) => pick('advice', p)}
        />

        <div>
          <p className="mb-1.5 text-sm font-medium">Next visit</p>
          <div className="flex flex-wrap items-center gap-2">
            {FOLLOW_UP_PICKS.map((f) => {
              const date = format(addDays(new Date(), f.days), 'yyyy-MM-dd')
              return (
                <Chip
                  key={f.days}
                  active={value.followUpDate === date}
                  onClick={() =>
                    set('followUpDate', value.followUpDate === date ? '' : date)
                  }
                >
                  {f.label}
                </Chip>
              )
            })}
            <DatePicker
              value={value.followUpDate || undefined}
              onChange={(d) => set('followUpDate', d)}
              placeholder="Pick a date"
              clearable
              min={format(new Date(), 'yyyy-MM-dd')}
              className="h-10 w-44"
            />
          </div>
        </div>
      </div>
    </section>
  )
}

function NoteBlock({
  label,
  value,
  placeholder,
  picks,
  onText,
  onPick,
}: {
  label: string
  value: string
  placeholder: string
  picks?: string[]
  onText: (text: string) => void
  onPick?: (phrase: string) => void
}) {
  const chosen = value.toLowerCase()
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{label}</p>
      {picks && onPick && (
        <div className="mb-2 flex flex-wrap gap-2">
          {picks.map((p) => (
            <Chip
              key={p}
              active={chosen.includes(p.toLowerCase())}
              onClick={() => onPick(p)}
            >
              {p}
            </Chip>
          ))}
        </div>
      )}
      <Textarea
        value={value}
        onChange={(e) => onText(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="min-h-[72px] text-base"
      />
    </div>
  )
}
