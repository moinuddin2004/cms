import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { QueueEntryActions } from './components/QueueEntryActions'
import { queuePermissionsFrom } from './hooks/useQueuePermissions'
import type { QueuePermissions } from './hooks/useQueuePermissions'
import type { QueueEntry } from './types'
import { accessWith, PERMS } from './test-access'

vi.mock('@/lib/api', () => ({ default: {}, apiClient: {} }))
// The access barrel re-exports RouteAccessGate → DashboardLayout → Sidebar,
// which imports the barrel back; loading it first leaves NAV_ITEMS undefined.
vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

const perms = (
  p: Parameters<typeof accessWith>[0],
  employeeId: string | null = 'd1',
) => queuePermissionsFrom(accessWith(p, employeeId))

describe('queuePermissionsFrom', () => {
  it('maps each queue permission to its flag', () => {
    expect(perms(PERMS.reception)).toMatchObject({
      canCheckIn: true,
      canManageEntries: true,
      canReprioritize: false,
      canRunAnyQueue: false,
      canRunOwnQueue: false,
      canManageSettings: false,
    })
    expect(perms(PERMS.admin)).toMatchObject({
      canReprioritize: true,
      canRunAnyQueue: true,
      canManageSettings: true,
    })
  })

  it('isDoctorOf: own queue with queue.doctor.own, any with queue.doctor.any', () => {
    const doctor = perms(PERMS.doctor, 'd1')
    expect(doctor.isDoctorOf('d1')).toBe(true)
    expect(doctor.isDoctorOf('d2')).toBe(false)
    expect(perms(PERMS.doctor, null).isDoctorOf('d1')).toBe(false)
    expect(perms({ 'queue.doctor.any': true }, null).isDoctorOf('d2')).toBe(
      true,
    )
    expect(perms(PERMS.reception).isDoctorOf('d1')).toBe(false)
  })

  it('reports nothing while access is still loading', () => {
    const loading = queuePermissionsFrom({
      can: () => false,
      employeeId: null,
      isLoading: true,
    })
    expect(loading.isLoading).toBe(true)
    expect(loading.canCheckIn || loading.canManageEntries).toBe(false)
  })
})

function entry(over: Partial<QueueEntry>): QueueEntry {
  return {
    id: 'e1',
    sessionId: 's1',
    token: 'A-001',
    tokenNumber: 1,
    queueType: 'walk_in',
    status: 'waiting',
    priorityClass: 'normal',
    urgentReason: null,
    urgentSince: null,
    patient: { id: 'p1', fullName: 'Pat', phone: null, patientNumber: null },
    appointmentId: null,
    scheduledStart: null,
    reasonForVisit: null,
    checkedInAt: '2026-10-12T09:00:00.000Z',
    sortAnchorAt: '2026-10-12T09:00:00.000Z',
    calledAt: null,
    consultationStartedAt: null,
    holdStartedAt: null,
    returnedFromHoldAt: null,
    skippedAt: null,
    finishedAt: null,
    convertedFromApptId: null,
    transferredFromId: null,
    version: 1,
    ...over,
  }
}

function renderActions(e: QueueEntry, role: QueuePermissions, doctorId = 'd1') {
  const client = new QueryClient()
  return render(
    <QueryClientProvider client={client}>
      <QueueEntryActions
        entry={e}
        doctorId={doctorId}
        role={role}
        rejoinPolicy="end"
        waiting={[]}
        handlers={{ onCancel: vi.fn(), onUrgent: vi.fn(), onTransfer: vi.fn() }}
      />
    </QueryClientProvider>,
  )
}

function openMenu(token = 'A-001') {
  const trigger = screen.getByRole('button', { name: `Actions for ${token}` })
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })
  fireEvent.click(trigger)
}

describe('QueueEntryActions gating', () => {
  it("reception can skip in any doctor's queue", () => {
    renderActions(entry({ status: 'called' }), perms(PERMS.reception), 'd2')
    expect(screen.getByRole('button', { name: /Didn.t come/ })).toBeTruthy()
  })

  it('a doctor can skip in their own queue but not in another', () => {
    const called = entry({ status: 'called' })
    const { unmount } = renderActions(called, perms(PERMS.doctor), 'd1')
    expect(screen.getByRole('button', { name: /Didn.t come/ })).toBeTruthy()
    unmount()
    renderActions(called, perms(PERMS.doctor), 'd2')
    expect(screen.queryByRole('button', { name: /Didn.t come/ })).toBeNull()
  })

  it('rejoin needs queue.entry.manage; back from test needs queue.checkin', () => {
    const { unmount } = renderActions(
      entry({ status: 'skipped' }),
      perms(PERMS.doctor),
    )
    expect(screen.queryByRole('button', { name: /Rejoin/ })).toBeNull()
    unmount()

    const again = renderActions(
      entry({ status: 'skipped' }),
      perms({ 'queue.entry.manage': true }),
    )
    expect(screen.getByRole('button', { name: /Rejoin/ })).toBeTruthy()
    again.unmount()

    renderActions(
      entry({ status: 'on_hold' }),
      perms({ 'queue.checkin': true }),
    )
    expect(screen.getByRole('button', { name: /Back from test/ })).toBeTruthy()
  })

  it('remove needs queue.entry.manage; urgent priority needs reprioritize', async () => {
    renderActions(entry({}), perms(PERMS.reception))
    openMenu()
    expect(await screen.findByText('Remove from queue')).toBeTruthy()
    expect(screen.getByText('Transfer to another doctor')).toBeTruthy()
    expect(screen.queryByText('Urgent priority')).toBeNull()
  })

  it('reprioritize alone shows urgent priority but not remove', async () => {
    renderActions(entry({}), perms({ 'queue.entry.reprioritize': true }))
    openMenu()
    expect(await screen.findByText('Urgent priority')).toBeTruthy()
    expect(screen.queryByText('Remove from queue')).toBeNull()
  })

  it("a doctor can transfer their own in-consultation patient, not another doctor's", async () => {
    const inRoom = entry({ status: 'in_consultation' })
    const { unmount } = renderActions(inRoom, perms(PERMS.doctor), 'd1')
    openMenu()
    expect(await screen.findByText('Transfer to another doctor')).toBeTruthy()
    unmount()

    renderActions(inRoom, perms(PERMS.doctor), 'd2')
    openMenu()
    expect(await screen.findByText('Print ticket')).toBeTruthy()
    expect(screen.queryByText('Transfer to another doctor')).toBeNull()
  })
})
