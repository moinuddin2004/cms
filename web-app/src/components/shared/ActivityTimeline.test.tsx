import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ActivityTimeline } from './ActivityTimeline'
import type { TimelineEntry } from './ActivityTimeline'

const base = {
  fromState: null,
  toState: null,
  reason: null,
  actorSide: 'clinic' as const,
  via: null,
  actor: { id: 'u1', name: 'Sana (reception)' },
  createdAt: '2026-10-23T09:00:00.000Z',
}

const entries: TimelineEntry[] = [
  {
    ...base,
    id: '5',
    kind: 'audit',
    entityType: 'patient',
    action: 'delete',
    changes: {
      before: { fullName: 'Ali', linkedRecords: { patient_vitals: 2 } },
      after: null,
    },
  },
  {
    ...base,
    id: '4',
    kind: 'status',
    entityType: 'patient',
    action: 'deactivate',
    fromState: 'active',
    toState: 'inactive',
    changes: null,
  },
  {
    ...base,
    id: '3',
    kind: 'audit',
    entityType: 'patient_vitals',
    action: 'create',
    changes: null,
  },
  {
    ...base,
    id: '2',
    kind: 'audit',
    entityType: 'patient',
    action: 'update',
    changes: {
      before: { city: 'Karachi', primaryLocationId: 'l1' },
      after: { city: 'Lahore', primaryLocationId: 'l2' },
    },
  },
  {
    ...base,
    id: '1',
    kind: 'audit',
    entityType: 'patient',
    action: 'create',
    changes: {
      before: null,
      after: { fullName: 'Ali', bpSystolic: 120, recordedBy: 'e1' },
    },
  },
]

describe('ActivityTimeline (merged patient history)', () => {
  it('describes each kind of change with the record it belongs to', () => {
    render(
      <ActivityTimeline
        entries={entries}
        isLoading={false}
        isError={false}
        onRetry={() => {}}
        fieldLabels={{ fullName: 'Name', bpSystolic: 'BP systolic' }}
        entityLabels={{ patient: 'Patient', patient_vitals: 'Vitals' }}
        hiddenFields={new Set(['recordedBy'])}
      />,
    )

    expect(screen.getByText('Patient deleted')).toBeTruthy()
    expect(screen.getByText('2 patient vitals removed with it')).toBeTruthy()
    expect(screen.getByText('Patient: active → inactive')).toBeTruthy()
    expect(screen.getByText('Vitals created')).toBeTruthy()
    expect(screen.getByText('Details are not shown to you.')).toBeTruthy()
    expect(screen.getByText('Patient edited')).toBeTruthy()
    expect(screen.getByText('City: Karachi → Lahore')).toBeTruthy()
    expect(screen.getByText('Name: Ali')).toBeTruthy()
    expect(screen.getByText('BP systolic: 120')).toBeTruthy()
    // Unlabelled ids and hidden staff ids are not listed.
    expect(screen.queryByText(/Primary location/)).toBeNull()
    expect(screen.queryByText(/Recorded by/)).toBeNull()
    expect(screen.getAllByText(/Sana \(reception\) \(clinic\)/)).toHaveLength(5)
  })

  it('shows the empty state when nothing was recorded', () => {
    render(
      <ActivityTimeline
        entries={[]}
        isLoading={false}
        isError={false}
        onRetry={() => {}}
      />,
    )
    expect(screen.getByText('No activity yet')).toBeTruthy()
  })
})
