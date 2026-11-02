import { addDays, format } from 'date-fns'
import { nowInClinic, todayYmd } from '@/lib/datetime'
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
import { Chip, ChipGroup } from './Chip'
import { Panel } from './Panel'
import { SaveBadge } from './SaveBadge'

type NoteField = Exclude<keyof VisitNotesValue, 'followUpDate'>

/**
 * The visit notes. Everything auto-saves; the most common phrases are one tap
 * each (the rest behind "+N more") so the doctor rarely needs the keyboard —
 * and when they do, Tab simply walks from one note to the next.
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
    <Panel
      icon={<ClipboardList />}
      title="Visit notes"
      action={<SaveBadge state={saveState} savedAt={savedAt} />}
      bodyClassName="@container"
    >
      {/* Two notes side by side once the column is wide enough — half the scrolling. */}
      <div className="grid items-start gap-4 @2xl:grid-cols-2">
        <NoteBlock
          id="note-complaint"
          label="Complaint"
          value={value.chiefComplaint}
          placeholder="Why did the patient come?"
          picks={COMPLAINT_PICKS}
          onText={(t) => set('chiefComplaint', t)}
          onPick={(p) => pick('chiefComplaint', p)}
        />
        <NoteBlock
          id="note-examination"
          label="Examination"
          value={value.examination}
          placeholder="Findings — tooth numbers, gums, X-ray…"
          onText={(t) => set('examination', t)}
        />
        <NoteBlock
          id="note-diagnosis"
          label="Diagnosis"
          value={value.diagnosis}
          placeholder="Diagnosis"
          picks={DIAGNOSIS_PICKS}
          onText={(t) => set('diagnosis', t)}
          onPick={(p) => pick('diagnosis', p)}
        />
        <NoteBlock
          id="note-advice"
          label="Advice to patient"
          value={value.advice}
          placeholder="Instructions for the patient"
          picks={ADVICE_PICKS}
          onText={(t) => set('advice', t)}
          onPick={(p) => pick('advice', p)}
        />

        <div className="space-y-1.5 @2xl:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Next visit
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {FOLLOW_UP_PICKS.map((f) => {
              const date = format(addDays(nowInClinic(), f.days), 'yyyy-MM-dd')
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
              min={todayYmd()}
              className="h-8 w-40 text-[13px]"
            />
          </div>
        </div>
      </div>
    </Panel>
  )
}

function NoteBlock({
  id,
  label,
  value,
  placeholder,
  picks,
  onText,
  onPick,
}: {
  id: string
  label: string
  value: string
  placeholder: string
  picks?: string[]
  onText: (text: string) => void
  onPick?: (phrase: string) => void
}) {
  const chosen = value.toLowerCase()
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {label}
      </label>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onText(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="max-h-40 min-h-14 resize-none"
      />
      {picks && onPick && (
        <ChipGroup
          items={picks}
          getKey={(p) => p}
          getLabel={(p) => p}
          isActive={(p) => chosen.includes(p.toLowerCase())}
          onPick={onPick}
          limit={5}
        />
      )}
    </div>
  )
}
