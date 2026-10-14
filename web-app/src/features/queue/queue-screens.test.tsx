import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useAuthStore } from '@/store/useAuthStore'
import { QueueBoard } from './components/QueueBoard'
import { CheckInDialog } from './components/CheckInDialog'
import { DoctorQueuePage } from './pages/DoctorQueuePage'
import type { QueueEntry, SessionSnapshot } from './types'

// ── Mocks: API transport, router Link, realtime socket, toasts ───────────
const api = vi.hoisted(() => ({
  get: vi.fn(),
  request: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}))
vi.mock('@/lib/api', () => ({ default: api, apiClient: api }))
const navigate = vi.hoisted(() => vi.fn())
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => navigate,
}))
vi.mock('../hooks/useQueueSocket', () => ({
  useQueueSocket: () => ({ connected: true }),
}))
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
}))

const iso = (hhmm: string) => `2026-10-12T${hhmm}:00.000Z`

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
    patient: {
      id: 'p1',
      fullName: 'Walk In One',
      phone: '0300',
      patientNumber: 'P-1',
    },
    appointmentId: null,
    scheduledStart: null,
    reasonForVisit: null,
    checkedInAt: iso('09:00'),
    sortAnchorAt: iso('09:00'),
    calledAt: null,
    consultationStartedAt: null,
    holdStartedAt: null,
    returnedFromHoldAt: null,
    skippedAt: null,
    finishedAt: null,
    convertedFromApptId: null,
    transferredFromId: null,
    version: 0,
    ...over,
  }
}

function snapshot(
  entries: QueueEntry[],
  over: Partial<SessionSnapshot['session']> = {},
): SessionSnapshot {
  const waiting = entries.filter((e) => e.status === 'waiting')
  return {
    session: {
      id: 's1',
      organizationId: 'o',
      locationId: 'l',
      doctorId: 'd1',
      doctorName: 'Aliyan',
      serviceDate: '2026-10-12',
      status: 'open',
      tokenPrefix: 'A',
      smartQueueEnabled: false,
      pauseReason: null,
      startedAt: iso('08:00'),
      closedAt: null,
      lastCallReason: null,
      eventSeq: 5,
      version: 1,
      ...over,
    },
    entries,
    waitingOrder: waiting.map((e) => e.id),
    suggestion: waiting[0] ? { entryId: waiting[0].id, reason: 'FIFO' } : null,
    now: iso('09:30'),
  }
}

const policy = {
  smartQueueEnabled: false,
  earlyWindowMin: 15,
  lateGraceMin: 10,
  maxLateMin: 45,
  walkinStarvationMin: 45,
  skippedRejoinPolicy: 'end' as const,
  callTimeoutSec: null,
  manualSelectReasonRequired: false,
  serviceDayCutoff: '00:00',
  timezone: 'UTC',
  source: 'default' as const,
}

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

const doctorsReply = {
  data: {
    data: [
      {
        id: 'd1',
        fullName: 'Aliyan',
        designation: 'Dentist',
        profilePictureUrl: null,
      },
      {
        id: 'd2',
        fullName: 'Sara',
        designation: 'Dentist',
        profilePictureUrl: null,
      },
    ],
  },
}

let myRoles: string[] = ['clinic_admin', 'receptionist', 'doctor']

/** Answers shared by every screen: my roles + the doctor list. */
function common(url: string) {
  if (url === '/queue/me')
    return Promise.resolve({
      data: { data: { roles: myRoles, employeeId: 'd1' } },
    })
  if (url === '/appointments/doctors') return Promise.resolve(doctorsReply)
  return null
}

beforeEach(() => {
  vi.clearAllMocks()
  myRoles = ['clinic_admin', 'receptionist', 'doctor']
  useAuthStore.setState({
    activeOrganizationId: 'o',
    activeLocationId: 'l',
    accessToken: 't',
  })
})

describe('QueueBoard (reception)', () => {
  function mockBoard(lanes: unknown[]) {
    api.get.mockImplementation((url: string) => {
      if (url === '/queue/sessions') {
        return Promise.resolve({
          data: {
            data: {
              serviceDate: '2026-10-12',
              now: iso('09:30'),
              policy,
              lanes,
            },
          },
        })
      }
      return common(url) ?? Promise.reject(new Error('unexpected ' + url))
    })
  }

  it('shows a lane per doctor with waiting patients in engine order and who is with the doctor', async () => {
    const entries = [
      entry({
        id: 'cur',
        token: 'A-001',
        status: 'in_consultation',
        patient: {
          id: 'p0',
          fullName: 'In Room Ravi',
          phone: null,
          patientNumber: null,
        },
      }),
      entry({
        id: 'w2',
        token: 'A-003',
        tokenNumber: 3,
        patient: {
          id: 'p3',
          fullName: 'Late Lina',
          phone: null,
          patientNumber: null,
        },
        queueType: 'appointment',
        appointmentId: 'a1',
        scheduledStart: iso('09:15'),
      }),
      entry({
        id: 'w1',
        token: 'A-002',
        tokenNumber: 2,
        patient: {
          id: 'p2',
          fullName: 'Walk Wasim',
          phone: null,
          patientNumber: null,
        },
      }),
    ]
    const snap = snapshot(entries)
    snap.waitingOrder = ['w2', 'w1'] // engine says the appointment goes first
    mockBoard([
      {
        doctor: {
          id: 'd1',
          fullName: 'Aliyan',
          designation: 'Dentist',
          profilePictureUrl: null,
          tokenPrefix: 'A',
        },
        snapshot: snap,
      },
      {
        doctor: {
          id: 'd2',
          fullName: 'Sara',
          designation: 'Dentist',
          profilePictureUrl: null,
          tokenPrefix: 'S',
        },
        snapshot: null,
      },
    ])

    renderWithClient(<QueueBoard />)

    expect(await screen.findByText('Dr. Aliyan')).toBeTruthy()
    expect(screen.getByText('Dr. Sara')).toBeTruthy()
    expect(screen.getByText('No patients yet')).toBeTruthy() // Sara has no session yet
    expect(screen.getByText('In Room Ravi')).toBeTruthy()

    const rows = screen.getAllByRole('listitem').map((li) => li.textContent)
    const iLina = rows.findIndex((t) => t.includes('Late Lina'))
    const iWasim = rows.findIndex((t) => t.includes('Walk Wasim'))
    expect(iLina).toBeGreaterThanOrEqual(0)
    expect(iLina).toBeLessThan(iWasim) // engine order, not token order
    expect(rows[iLina]).toContain('Appointment')
    expect(rows[iWasim]).toContain('Walk-in')
  })

  it('filters by search and shows a distinct no-results state', async () => {
    const snap = snapshot([
      entry({
        id: 'w1',
        patient: {
          id: 'p2',
          fullName: 'Walk Wasim',
          phone: null,
          patientNumber: null,
        },
      }),
    ])
    mockBoard([
      {
        doctor: {
          id: 'd1',
          fullName: 'Aliyan',
          designation: '',
          profilePictureUrl: null,
          tokenPrefix: 'A',
        },
        snapshot: snap,
      },
    ])
    renderWithClient(<QueueBoard />)
    await screen.findByText('Walk Wasim')

    fireEvent.change(screen.getByPlaceholderText(/Search token/i), {
      target: { value: 'zzz-nothing' },
    })
    expect(
      await screen.findByText(
        'No patients match your filters',
        {},
        { timeout: 2000 },
      ),
    ).toBeTruthy()
    expect(
      screen.getAllByRole('button', { name: /Clear/i }).length,
    ).toBeGreaterThan(0)
  })

  it('shows an empty state when the location has no doctors', async () => {
    mockBoard([])
    renderWithClient(<QueueBoard />)
    expect(
      await screen.findByText('No doctors at this location yet'),
    ).toBeTruthy()
  })

  it('shows an error state with retry when loading fails', async () => {
    api.get.mockImplementation(
      (url: string) => common(url) ?? Promise.reject(new Error('boom')),
    )
    renderWithClient(<QueueBoard />)
    expect(await screen.findByText('Could not load the queue')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /retry|try again/i }),
    ).toBeTruthy()
  })

  it('removing a waiting patient sends cancel with the entry version as If-Match and an Idempotency-Key', async () => {
    const snap = snapshot([
      entry({
        id: 'w1',
        version: 7,
        patient: {
          id: 'p2',
          fullName: 'Walk Wasim',
          phone: null,
          patientNumber: null,
        },
      }),
    ])
    mockBoard([
      {
        doctor: {
          id: 'd1',
          fullName: 'Aliyan',
          designation: '',
          profilePictureUrl: null,
          tokenPrefix: 'A',
        },
        snapshot: snap,
      },
    ])
    api.request.mockResolvedValue({
      data: {
        data: {
          entry: entry({ id: 'w1', status: 'cancelled', version: 8 }),
          eventSeq: 6,
        },
      },
    })
    renderWithClient(<QueueBoard />)
    await screen.findByText('Walk Wasim')

    // open the row menu (Radix opens on pointer down)
    const trigger = screen.getByRole('button', { name: 'Actions for A-001' })
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })
    fireEvent.click(trigger)
    fireEvent.click(await screen.findByText('Remove from queue'))

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Remove from queue' }),
    )

    await waitFor(() => expect(api.request).toHaveBeenCalled())
    const call = api.request.mock.calls[0][0]
    expect(call.method).toBe('patch')
    expect(call.url).toBe('/queue/entries/w1/cancel')
    expect(call.headers['If-Match']).toBe('7')
    expect(call.headers['Idempotency-Key']).toBeTruthy()
  })
})

describe('DoctorQueuePage', () => {
  function mockMine(snap: SessionSnapshot) {
    api.get.mockImplementation((url: string) => {
      if (url === '/queue/my-session')
        return Promise.resolve({ data: { data: snap } })
      if (url === '/queue/policies')
        return Promise.resolve({
          data: {
            data: {
              organizationDefault: null,
              locationOverride: null,
              effective: policy,
            },
          },
        })
      return common(url) ?? Promise.reject(new Error('unexpected ' + url))
    })
  }

  it('Call next is enabled for an open queue with waiting patients and names the suggestion', async () => {
    mockMine(
      snapshot([
        entry({ id: 'w1' }),
        entry({ id: 'w2', token: 'A-002', tokenNumber: 2 }),
      ]),
    )
    renderWithClient(<DoctorQueuePage />)
    const btn = await screen.findByRole('button', {
      name: /Call next/i,
    })
    expect(btn.hasAttribute('disabled')).toBe(false)
    expect(btn.textContent).toContain('A-001')
  })

  it('Call next is disabled while a patient is with the doctor, and the current card offers Complete', async () => {
    mockMine(
      snapshot([
        entry({
          id: 'cur',
          status: 'in_consultation',
          patient: {
            id: 'p9',
            fullName: 'Current Cara',
            phone: '0301',
            patientNumber: null,
          },
        }),
        entry({ id: 'w2', token: 'A-002', tokenNumber: 2 }),
      ]),
    )
    renderWithClient(<DoctorQueuePage />)
    const btn = await screen.findByRole('button', {
      name: /Call next/i,
    })
    expect(btn.hasAttribute('disabled')).toBe(true)
    expect(screen.getByText('Current Cara')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Complete/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Send for test/i })).toBeTruthy()
  })

  it('Call next is disabled until the doctor starts the queue', async () => {
    mockMine(
      snapshot([entry({ id: 'w1' })], {
        status: 'waiting_for_doctor',
        startedAt: null,
      }),
    )
    renderWithClient(<DoctorQueuePage />)
    const btn = await screen.findByRole('button', {
      name: /Call next/i,
    })
    expect(btn.hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: /Start my queue/i })).toBeTruthy()
  })

  it('a called patient can be started, recalled, skipped or undone', async () => {
    mockMine(
      snapshot([entry({ id: 'c1', status: 'called', calledAt: iso('09:29') })]),
    )
    renderWithClient(<DoctorQueuePage />)
    expect(await screen.findByRole('button', { name: /start/i })).toBeTruthy()
    for (const name of [/Call again/i, /Didn't come/i, /Undo call/i]) {
      expect(screen.getByRole('button', { name })).toBeTruthy()
    }
  })

  it('starting a consultation opens the consultation screen for that visit', async () => {
    mockMine(
      snapshot([entry({ id: 'c1', status: 'called', calledAt: iso('09:29') })]),
    )
    api.request.mockResolvedValue({
      data: {
        data: {
          entry: entry({ id: 'c1', status: 'in_consultation' }),
          eventSeq: 7,
          encounterId: 'enc-1',
        },
      },
    })
    renderWithClient(<DoctorQueuePage />)
    fireEvent.click(await screen.findByRole('button', { name: /start/i }))
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: '/consultation/$encounterId',
        params: { encounterId: 'enc-1' },
      }),
    )
    expect(api.request.mock.calls[0][0].url).toBe(
      '/queue/entries/c1/start-consultation',
    )
  })

  it('a patient already in the room can be reopened in the consultation screen', async () => {
    mockMine(snapshot([entry({ id: 'cur', status: 'in_consultation' })]))
    const base = api.get.getMockImplementation()!
    api.get.mockImplementation((url: string) =>
      url === '/encounters/by-queue-entry/cur'
        ? Promise.resolve({
            data: { data: { encounter: { id: 'enc-9' }, queueEntry: null } },
          })
        : base(url),
    )
    renderWithClient(<DoctorQueuePage />)
    fireEvent.click(
      await screen.findByRole('button', { name: /Open consultation/i }),
    )
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: '/consultation/$encounterId',
        params: { encounterId: 'enc-9' },
      }),
    )
  })

  it('Call next posts to the session call-next endpoint with an Idempotency-Key', async () => {
    mockMine(snapshot([entry({ id: 'w1' })]))
    api.request.mockResolvedValue({
      data: {
        data: {
          entry: entry({ id: 'w1', status: 'called' }),
          reason: 'FIFO',
          eventSeq: 6,
        },
      },
    })
    renderWithClient(<DoctorQueuePage />)
    fireEvent.click(await screen.findByRole('button', { name: /Call next/i }))
    await waitFor(() => expect(api.request).toHaveBeenCalled())
    const call = api.request.mock.calls[0][0]
    expect(call.url).toBe('/queue/sessions/s1/call-next')
    expect(call.method).toBe('post')
    expect(call.headers['Idempotency-Key']).toBeTruthy()
  })

  it('shows a friendly error when the user is not a doctor here', async () => {
    api.get.mockRejectedValue({
      response: {
        data: {
          message: 'Doctor profile not found',
          error: { code: 'NOT_FOUND' },
        },
      },
    })
    renderWithClient(<DoctorQueuePage />)
    expect(
      await screen.findByText(
        'You are not set up as a doctor at this location',
      ),
    ).toBeTruthy()
  })
})

describe('CheckInDialog', () => {
  const target = {
    id: 'a1',
    patientName: 'Booked Bina',
    doctorName: 'Aliyan',
    startTime: iso('10:00'),
  }

  it('urgent priority needs a reason before check-in is allowed', async () => {
    renderWithClient(<CheckInDialog target={target} onOpenChange={() => {}} />)
    const submit = screen.getByRole('button', {
      name: /Check in & get token/i,
    })
    expect(submit.hasAttribute('disabled')).toBe(false)

    fireEvent.click(screen.getByLabelText(/Give urgent priority/i))
    expect(submit.hasAttribute('disabled')).toBe(true)
    fireEvent.change(screen.getByPlaceholderText(/severe bleeding/i), {
      target: { value: 'chest pain' },
    })
    expect(submit.hasAttribute('disabled')).toBe(false)
  })

  it('past the late limit it offers Convert to walk-in instead', async () => {
    api.request
      .mockRejectedValueOnce({
        response: {
          status: 422,
          data: {
            message: 'More than 45 minutes late',
            error: { code: 'LATE_LIMIT_EXCEEDED' },
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            entry: entry({ id: 'n1' }),
            token: 'A-005',
            sessionId: 's1',
            doctorId: 'd1',
            serviceDate: '2026-10-12',
            eventSeq: 9,
          },
        },
      })
    renderWithClient(<CheckInDialog target={target} onOpenChange={() => {}} />)

    fireEvent.click(
      screen.getByRole('button', { name: /Check in & get token/i }),
    )
    const convert = await screen.findByRole('button', {
      name: /Convert to walk-in/i,
    })
    expect(screen.getByText(/marked as a no-show/i)).toBeTruthy()

    fireEvent.click(convert)
    await waitFor(() => expect(api.request).toHaveBeenCalledTimes(2))
    expect(api.request.mock.calls[1][0].url).toBe(
      '/appointments/a1/convert-to-walk-in',
    )
  })
})

describe('QueueBoard — roles, admin options and list view', () => {
  const lane = (snap: SessionSnapshot | null) => ({
    doctor: {
      id: 'd1',
      fullName: 'Aliyan',
      designation: '',
      profilePictureUrl: null,
      tokenPrefix: 'A',
    },
    snapshot: snap,
  })
  function mockBoard(lanes: unknown[]) {
    api.get.mockImplementation((url: string) => {
      if (url === '/queue/sessions') {
        return Promise.resolve({
          data: {
            data: {
              serviceDate: '2026-10-12',
              now: iso('09:30'),
              policy,
              lanes,
            },
          },
        })
      }
      return common(url) ?? Promise.reject(new Error('unexpected ' + url))
    })
  }
  async function openMenu(token: string) {
    const trigger = await screen.findByRole('button', {
      name: `Actions for ${token}`,
    })
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })
    fireEvent.click(trigger)
  }

  it('a receptionist sees reception actions but not admin-only ones', async () => {
    myRoles = ['receptionist']
    mockBoard([
      lane(
        snapshot([
          entry({ id: 'w1' }),
          entry({
            id: 'c1',
            token: 'A-002',
            tokenNumber: 2,
            status: 'in_consultation',
          }),
        ]),
      ),
    ])
    renderWithClient(<QueueBoard />)
    // check page-level buttons before a menu opens (Radix hides the rest of the page)
    await screen.findByRole('button', { name: 'Actions for A-001' })
    expect(
      await screen.findByRole('button', { name: /^Walk-in$/ }),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Force complete' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Queue options/i })).toBeNull()
    await openMenu('A-001')
    expect(await screen.findByText('Remove from queue')).toBeTruthy()
    expect(screen.queryByText('Urgent priority')).toBeNull()
  })

  it('a doctor-only user cannot add walk-ins or remove patients', async () => {
    myRoles = ['doctor']
    mockBoard([lane(snapshot([entry({ id: 'w1' })]))])
    renderWithClient(<QueueBoard />)
    await screen.findByRole('button', { name: 'Actions for A-001' })
    expect(screen.queryByRole('button', { name: /^Walk-in$/ })).toBeNull()
    await openMenu('A-001')
    expect(await screen.findByText('Print ticket')).toBeTruthy()
    expect(screen.queryByText('Remove from queue')).toBeNull()
  })

  it('an admin can force-complete and switch today’s queue mode', async () => {
    mockBoard([
      lane(
        snapshot([entry({ id: 'c1', status: 'in_consultation', version: 4 })]),
      ),
    ])
    api.request.mockResolvedValue({
      data: {
        data: {
          entry: entry({ id: 'c1', status: 'completed' }),
          eventSeq: 9,
          session: {},
        },
      },
    })
    renderWithClient(<QueueBoard />)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Force complete' }),
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'Mark completed' }),
    )
    await waitFor(() => expect(api.request).toHaveBeenCalled())
    expect(api.request.mock.calls[0][0].url).toBe(
      '/queue/entries/c1/force-complete',
    )
    expect(api.request.mock.calls[0][0].headers['If-Match']).toBe('4')

    const opts = screen.getByRole('button', {
      name: /Queue options for Dr. Aliyan/i,
    })
    fireEvent.pointerDown(opts, { button: 0, ctrlKey: false })
    fireEvent.click(opts)
    fireEvent.click(await screen.findByText('Switch to smart queue'))
    await waitFor(() => expect(api.request).toHaveBeenCalledTimes(2))
    expect(api.request.mock.calls[1][0].url).toBe('/queue/sessions/s1/mode')
    expect(api.request.mock.calls[1][0].data).toEqual({
      smartQueueEnabled: true,
    })
  })

  it('list view shows every patient in one table, active ones first', async () => {
    mockBoard([
      lane(
        snapshot([
          entry({
            id: 'done',
            token: 'A-001',
            status: 'completed',
            patient: {
              id: 'p1',
              fullName: 'Done Dina',
              phone: null,
              patientNumber: null,
            },
          }),
          entry({
            id: 'w1',
            token: 'A-002',
            tokenNumber: 2,
            patient: {
              id: 'p2',
              fullName: 'Waiting Wali',
              phone: null,
              patientNumber: null,
            },
          }),
        ]),
      ),
    ])
    renderWithClient(<QueueBoard />)
    await screen.findByText('Waiting Wali')
    fireEvent.click(screen.getByRole('tab', { name: 'List view' }))
    const table = await screen.findByRole('table')
    const rows = within(table)
      .getAllByRole('row')
      .map((r) => r.textContent)
    const iWali = rows.findIndex((t) => t.includes('Waiting Wali'))
    const iDina = rows.findIndex((t) => t.includes('Done Dina'))
    expect(iWali).toBeGreaterThan(0)
    expect(iWali).toBeLessThan(iDina)
  })
})

describe('WalkInSheet', () => {
  beforeEach(() => {
    api.get.mockImplementation(
      (url: string) =>
        common(url) ?? Promise.resolve({ data: { data: { data: [] } } }),
    )
  })

  it('validates a new patient and blocks submit until name, phone and doctor are valid', async () => {
    const { WalkInSheet } = await import('./components/WalkInSheet')
    renderWithClient(
      <WalkInSheet open onOpenChange={() => {}} defaultDoctorId="d1" />,
    )
    fireEvent.click(await screen.findByRole('tab', { name: /New patient/i }))
    const name = screen.getByLabelText(/Patient name/i)
    const phone = screen.getByLabelText(/^Phone/i)
    fireEvent.change(phone, { target: { value: '12' } })
    fireEvent.blur(phone)
    expect(await screen.findByText('Enter a valid phone number')).toBeTruthy()
    const submit = screen.getByRole('button', {
      name: 'Add to queue',
    })
    expect(submit.hasAttribute('disabled')).toBe(true)

    fireEvent.change(name, { target: { value: 'New Nadia' } })
    fireEvent.change(phone, { target: { value: '0300-1234567' } })
    await waitFor(() => expect(submit.hasAttribute('disabled')).toBe(false))
  })

  it('shows the existing token when the patient is already in that doctor’s queue', async () => {
    api.request.mockRejectedValue({
      response: {
        status: 409,
        data: {
          message: 'already',
          error: { code: 'ALREADY_CHECKED_IN', entry: { token: 'A-004' } },
        },
      },
    })
    const { WalkInSheet } = await import('./components/WalkInSheet')
    renderWithClient(
      <WalkInSheet open onOpenChange={() => {}} defaultDoctorId="d1" />,
    )
    fireEvent.click(await screen.findByRole('tab', { name: /New patient/i }))
    fireEvent.change(screen.getByLabelText(/Patient name/i), {
      target: { value: 'Repeat Rida' },
    })
    fireEvent.change(screen.getByLabelText(/^Phone/i), {
      target: { value: '0300-7654321' },
    })
    const submit = screen.getByRole('button', {
      name: 'Add to queue',
    })
    await waitFor(() => expect(submit.hasAttribute('disabled')).toBe(false))
    fireEvent.click(submit)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('A-004')
    expect(api.request.mock.calls[0][0].url).toBe('/queue/walk-ins')
    expect(api.request.mock.calls[0][0].data).toMatchObject({
      doctorId: 'd1',
      patientName: 'Repeat Rida',
      force: false,
    })
  })
})
