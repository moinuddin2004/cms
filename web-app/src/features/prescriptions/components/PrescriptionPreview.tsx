import { useMemo } from 'react'
import type {
  Prescription,
  PrescriptionMedicine,
  PrescriptionTemplate,
} from '../types'
import { MealRelation } from '../types'
import { formatInClinic, todayYmd } from '@/lib/datetime'

const MEAL_LABEL: Record<MealRelation, string> = {
  [MealRelation.BEFORE_MEAL]: 'Before meal',
  [MealRelation.AFTER_MEAL]: 'After meal',
  [MealRelation.WITH_MEAL]: 'With meal',
  [MealRelation.EMPTY_STOMACH]: 'Empty stomach',
  [MealRelation.NONE]: '',
}

const URDU_FONT_LINK_ID = 'urdu-nastaliq-font'

/**
 * Live, on-screen rendering of the prescription as it will appear on paper.
 * Updates instantly as the doctor types — no debounce, no PDF round-trip.
 *
 * Urdu strings render with the Nastaliq Google font (loaded on mount). The
 * server-side PDF can't shape Urdu without a bundled Nastaliq font file, so
 * for now Urdu fidelity is a preview-only feature with PDF as a planned
 * follow-up.
 */
export interface PreviewData extends Partial<
  Omit<Prescription, 'medicines' | 'patient' | 'doctor'>
> {
  medicines?: PrescriptionMedicine[]
  patient?: Prescription['patient']
  doctor?: Prescription['doctor']
}

interface PrescriptionPreviewProps {
  data: PreviewData
  template?: PrescriptionTemplate | null
  signatureImageUrl?: string | null
}

export function PrescriptionPreview({
  data,
  template,
  signatureImageUrl,
}: PrescriptionPreviewProps) {
  // Lazy-load the Nastaliq font once.
  useUrduFont()

  const styling = template?.styling ?? {}
  const header = template?.header ?? {}
  const footer = template?.footer ?? {}

  const primary = styling.primaryColor ?? '#0d9488'
  const showUrdu = styling.showMedicineUrdu !== false

  const meds = useMemo(
    () =>
      (data.medicines ?? [])
        .slice()
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [data.medicines],
  )

  const age = ageFromDob(data.patient?.dob)

  return (
    <div className="prescription-preview bg-white text-[#0f172a] rounded-lg shadow-sm border print:shadow-none print:border-none">
      <style>{`
        .prescription-preview { font-family: 'Inter', system-ui, sans-serif; font-size: 11px; line-height: 1.45; }
        .prescription-preview .urdu { font-family: 'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif; direction: rtl; text-align: right; font-size: 13px; line-height: 1.9; }
        .prescription-preview .rx { font-family: 'Times New Roman', serif; font-weight: 700; font-size: 22px; }
      `}</style>

      {/* Header */}
      <div
        className="px-5 pt-4 pb-3 border-b-2"
        style={{ borderColor: primary }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p
              className="font-bold text-base leading-tight"
              style={{ color: primary }}
            >
              {data.doctor?.fullName
                ? `Dr. ${data.doctor.fullName}`
                : 'Dr. [Doctor]'}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {header.doctorQualification ?? data.doctor?.designation ?? ''}
            </p>
            {header.doctorPhone && (
              <p className="text-[10px] text-muted-foreground">
                {header.doctorPhone}
              </p>
            )}
          </div>
          <div className="text-right">
            <p
              className="font-bold text-sm leading-tight"
              style={{ color: primary }}
            >
              {header.clinicName ?? 'Clinic Name'}
            </p>
            {header.clinicNameUrdu && (
              <p className="urdu text-[11px]" style={{ color: primary }}>
                {header.clinicNameUrdu}
              </p>
            )}
            {header.registrationNumber && (
              <p className="text-[10px] text-muted-foreground">
                Reg #: {header.registrationNumber}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Patient bar */}
      <div className="bg-slate-50 border-b px-5 py-2 text-[10px] grid grid-cols-3 gap-2">
        <span>
          <span className="text-muted-foreground">Name:</span>{' '}
          <span className="font-medium">{data.patient?.fullName ?? '—'}</span>
        </span>
        {age != null && (
          <span>
            <span className="text-muted-foreground">Age:</span>{' '}
            <span className="font-medium">{age} yrs</span>
          </span>
        )}
        {data.patient?.gender && (
          <span>
            <span className="text-muted-foreground">Gender:</span>{' '}
            <span className="font-medium capitalize">
              {data.patient.gender}
            </span>
          </span>
        )}
        {data.patient?.patientNumber && (
          <span>
            <span className="text-muted-foreground">Reg #:</span>{' '}
            <span className="font-medium">{data.patient.patientNumber}</span>
          </span>
        )}
        <span>
          <span className="text-muted-foreground">Date:</span>{' '}
          <span className="font-medium">
            {formatInClinic(data.createdAt ?? Date.now(), 'dd/MM/yyyy')}
          </span>
        </span>
        {data.prescriptionNumber && (
          <span>
            <span className="text-muted-foreground">RX:</span>{' '}
            <span className="font-mono font-medium">
              {data.prescriptionNumber}
            </span>
          </span>
        )}
      </div>

      {/* Vitals */}
      {styling.showVitals !== false && data.vitals && hasAny(data.vitals) && (
        <div className="px-5 py-2 border-b text-[10px] flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
          {data.vitals.bp && (
            <span>
              BP:{' '}
              <span className="text-foreground font-medium">
                {data.vitals.bp}
              </span>
            </span>
          )}
          {data.vitals.pulse && (
            <span>
              Pulse:{' '}
              <span className="text-foreground font-medium">
                {data.vitals.pulse}
              </span>
            </span>
          )}
          {data.vitals.temperature && (
            <span>
              Temp:{' '}
              <span className="text-foreground font-medium">
                {data.vitals.temperature}
              </span>
            </span>
          )}
          {data.vitals.spo2 && (
            <span>
              SpO₂:{' '}
              <span className="text-foreground font-medium">
                {data.vitals.spo2}
              </span>
            </span>
          )}
          {data.vitals.weight && (
            <span>
              Weight:{' '}
              <span className="text-foreground font-medium">
                {data.vitals.weight}
              </span>
            </span>
          )}
        </div>
      )}

      {/* Diagnosis / complaint */}
      {(data.chiefComplaint || data.diagnosis) && (
        <div className="px-5 py-2 border-b text-[10.5px] space-y-1">
          {data.chiefComplaint && (
            <p>
              <span className="text-muted-foreground font-semibold uppercase text-[9px]">
                Complaint:
              </span>{' '}
              {data.chiefComplaint}
            </p>
          )}
          {data.diagnosis && (
            <p>
              <span className="text-muted-foreground font-semibold uppercase text-[9px]">
                Diagnosis:
              </span>{' '}
              {data.diagnosis}
            </p>
          )}
        </div>
      )}

      {/* Medicines */}
      <div className="px-5 py-3 min-h-[180px]">
        <p className="rx mb-2" style={{ color: primary }}>
          ℞
        </p>
        {meds.length === 0 ? (
          <p className="italic text-muted-foreground text-xs">
            Add a medicine to see it here.
          </p>
        ) : (
          <ol className="space-y-2.5">
            {meds.map((m, idx) => (
              <li
                key={m.id ?? idx}
                className="grid grid-cols-12 gap-3 items-start"
              >
                <div className="col-span-7">
                  <p className="font-semibold">
                    <span className="mr-1">{idx + 1}.</span>
                    {m.medicineName || (
                      <span className="text-muted-foreground italic">
                        [Medicine]
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {[m.dosage, m.frequency, m.duration && `× ${m.duration}`]
                      .filter(Boolean)
                      .join('  ·  ')}
                    {m.mealRelation && m.mealRelation !== MealRelation.NONE && (
                      <span className="ml-1.5">
                        ({MEAL_LABEL[m.mealRelation]})
                      </span>
                    )}
                  </p>
                  {m.specialInstructions && (
                    <p className="text-[10px] italic text-muted-foreground mt-0.5">
                      {m.specialInstructions}
                    </p>
                  )}
                </div>
                {showUrdu && (
                  <div className="col-span-5">
                    {m.medicineNameUrdu && (
                      <p className="urdu font-semibold">{m.medicineNameUrdu}</p>
                    )}
                    {m.specialInstructionsUrdu && (
                      <p className="urdu text-[12px]">
                        {m.specialInstructionsUrdu}
                      </p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Instructions */}
      {(data.instructionsEnglish || data.instructionsUrdu) && (
        <div className="px-5 py-3 border-t grid grid-cols-2 gap-4">
          {data.instructionsEnglish && (
            <div>
              <p className="text-[9px] uppercase font-semibold text-muted-foreground tracking-wider mb-1">
                Instructions
              </p>
              <p className="text-[11px] whitespace-pre-wrap">
                {data.instructionsEnglish}
              </p>
            </div>
          )}
          {data.instructionsUrdu && (
            <div>
              <p className="text-[9px] uppercase font-semibold text-muted-foreground tracking-wider mb-1 text-right">
                ہدایات
              </p>
              <p className="urdu whitespace-pre-wrap">
                {data.instructionsUrdu}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Further plan */}
      {data.furtherPlan && (
        <div className="px-5 py-3 border-t">
          <p className="text-[9px] uppercase font-semibold text-muted-foreground tracking-wider mb-1">
            Further Plan
          </p>
          <p className="text-[11px] whitespace-pre-wrap">{data.furtherPlan}</p>
        </div>
      )}

      {/* Signature */}
      <div className="px-5 py-4 flex items-end justify-end">
        <div className="text-right">
          {signatureImageUrl ? (
            <img
              src={signatureImageUrl}
              alt="Doctor signature"
              className="h-12 inline-block object-contain"
            />
          ) : (
            <div className="h-12 w-32 border-b border-dashed border-muted-foreground/40" />
          )}
          <p className="mt-1 text-[10px] text-muted-foreground border-t pt-1 w-32 ml-auto text-center">
            {data.doctor?.fullName ? `Dr. ${data.doctor.fullName}` : 'Doctor'}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div
        className="px-5 py-2 text-[9px] text-center text-muted-foreground border-t"
        style={{ background: '#f8fafc' }}
      >
        <div className="space-y-0.5">
          <p>
            {[footer.address, footer.timings, footer.phone, footer.website]
              .filter(Boolean)
              .join('  ·  ')}
          </p>
          {footer.disclaimerText && (
            <p className="italic">{footer.disclaimerText}</p>
          )}
          {footer.disclaimerTextUrdu && (
            <p className="urdu text-[11px]">{footer.disclaimerTextUrdu}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function hasAny(o: Record<string, any> | null | undefined) {
  if (!o) return false
  return Object.values(o).some((v) => v !== undefined && v !== null && v !== '')
}

function ageFromDob(dob?: string | null): number | null {
  if (!dob) return null
  const [y, m, d] = dob.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  const [ty, tm, td] = todayYmd().split('-').map(Number)
  let years = ty - y
  if (tm < m || (tm === m && td < d)) years--
  return years
}

function useUrduFont() {
  if (typeof document === 'undefined') return
  if (document.getElementById(URDU_FONT_LINK_ID)) return
  const link = document.createElement('link')
  link.id = URDU_FONT_LINK_ID
  link.rel = 'stylesheet'
  link.href =
    'https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;600&display=swap'
  document.head.appendChild(link)
}
