import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ProcedureOption } from './types'
import { TreatmentsToday } from './components/TreatmentsToday'
import {
  OTHER_PROCEDURE,
  buildTreatmentInput,
  filterProcedures,
} from './utils/treatmentInput'

const filling: ProcedureOption = { id: 's1', name: 'Filling', code: 'FIL' }
const scaling: ProcedureOption = { id: 's2', name: 'Scaling', code: null }

const mutate = vi.fn()
let catalog: { data: ProcedureOption[]; isLoading: boolean }

vi.mock('./hooks/useConsultation', () => ({
  useAddTreatment: () => ({ mutate, isPending: false }),
  useProcedureCatalog: () => catalog,
}))

describe('buildTreatmentInput', () => {
  const draft = { selected: null as string | null, name: '', tooth: '' }

  it('sends a picked service by id, with the tooth as a note and no price', () => {
    expect(
      buildTreatmentInput({ ...draft, selected: 's1', tooth: ' 16 ' }, [
        filling,
      ]),
    ).toEqual({ serviceId: 's1', notes: 'Tooth: 16' })
  })

  it('waits for a pick when the clinic has a catalog', () => {
    expect(buildTreatmentInput({ ...draft, name: 'Filling' }, [filling])).toBe(
      null,
    )
  })

  it('takes a typed name for "Other" and for clinics without a catalog', () => {
    expect(
      buildTreatmentInput(
        { ...draft, selected: OTHER_PROCEDURE, name: ' Bleaching ' },
        [filling],
      ),
    ).toEqual({ treatmentName: 'Bleaching', notes: undefined })
    expect(buildTreatmentInput({ ...draft, name: 'Bleaching' }, [])).toEqual({
      treatmentName: 'Bleaching',
      notes: undefined,
    })
    expect(buildTreatmentInput(draft, [])).toBe(null)
  })

  it('filters procedures by name or code', () => {
    expect(filterProcedures([filling, scaling], 'fil')).toEqual([filling])
    expect(filterProcedures([filling, scaling], 'FIL')).toEqual([filling])
    expect(filterProcedures([filling, scaling], '')).toHaveLength(2)
  })
})

describe('TreatmentsToday', () => {
  beforeEach(() => {
    mutate.mockReset()
    catalog = { data: [filling, scaling], isLoading: false }
  })

  const renderIt = (treatments = []) =>
    render(
      <TreatmentsToday
        encounterId="e1"
        patientId="p1"
        treatments={treatments}
      />,
    )

  it('has no fee field and adds the picked service', () => {
    renderIt()
    expect(screen.queryByLabelText('Fee')).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Add' }).hasAttribute('disabled'),
    ).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Filling' }))
    fireEvent.change(screen.getByLabelText('Tooth number'), {
      target: { value: '26' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(mutate).toHaveBeenCalledWith(
      { serviceId: 's1', notes: 'Tooth: 26' },
      expect.any(Object),
    )
  })

  it('shows a name box only after choosing "Other…"', () => {
    renderIt()
    expect(screen.queryByLabelText('Procedure')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Other…' }))
    fireEvent.change(screen.getByLabelText('Procedure'), {
      target: { value: 'Bleaching' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(mutate).toHaveBeenCalledWith(
      { treatmentName: 'Bleaching', notes: undefined },
      expect.any(Object),
    )
  })

  it('falls back to typing a name when the clinic has no catalog', () => {
    catalog = { data: [], isLoading: false }
    renderIt()
    expect(screen.getByLabelText('Procedure')).toBeTruthy()
    expect(screen.queryByLabelText('Fee')).toBeNull()
  })

  it('never shows a price for treatments already recorded', () => {
    renderIt([
      {
        id: 't1',
        treatmentName: 'Extraction',
        notes: null,
        cost: 3000,
      } as never,
    ])
    expect(screen.getByText('Extraction')).toBeTruthy()
    expect(screen.queryByText(/3,000|3000|Rs\./)).toBeNull()
  })
})
