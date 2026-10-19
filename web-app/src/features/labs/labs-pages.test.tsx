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

import { LabDirectoryPage } from './pages/LabDirectoryPage'
import { LabLinksPage } from './pages/LabLinksPage'
import { labLinkSchema, labSchema } from './schemas/lab.schema'
import type { Lab, LabLink, Paginated } from './types'

// ── Mocks: API transport, router, toasts, page chrome ────────────────────
const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
}))
vi.mock('@/lib/api', () => ({ default: api, apiClient: api }))
const navigate = vi.hoisted(() => vi.fn())
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => navigate,
}))
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))
vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({
    title,
    actions,
    children,
  }: {
    title?: string
    actions?: ReactNode
    children: ReactNode
  }) => (
    <main>
      <h1>{title}</h1>
      {actions}
      {children}
    </main>
  ),
}))

const page = <T,>(data: T[]): { data: { data: Paginated<T> } } => ({
  data: {
    data: { data, total: data.length, page: 1, limit: 20, totalPages: 1 },
  },
})

const summary = {
  id: 'lab-1',
  name: 'Precision Dental Lab',
  labType: 'external' as const,
  phone: '0300 1234567',
  whatsappPhone: null,
  email: 'hello@precision.test',
  city: 'Karachi',
  address: null,
  status: 'active' as const,
}

const link = (over: Partial<LabLink> = {}): LabLink => ({
  id: 'link-1',
  status: 'active',
  paymentTermsDays: 30,
  patientDataLevel: 'full_name',
  activatedAt: '2026-10-01T10:00:00.000Z',
  notes: null,
  version: 3,
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
  lab: summary,
  ...over,
})

const lab = (over: Partial<Lab> = {}): Lab => ({
  ...summary,
  ownerOrganization: null,
  memberCount: 2,
  activeLinkCount: 5,
  version: 1,
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
  ...over,
})

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('LabLinksPage (clinic lab list)', () => {
  it('shows the empty state with a call to action', async () => {
    api.get.mockResolvedValue(page([]))
    renderWithClient(<LabLinksPage />)
    expect(await screen.findByText('No labs yet')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /add lab/i }).length).toBe(2)
  })

  it('lists labs and sends the status filter to the API', async () => {
    api.get.mockResolvedValue(page([link()]))
    renderWithClient(<LabLinksPage />)

    expect(await screen.findByText('Precision Dental Lab')).toBeTruthy()
    expect(screen.getByText('30 days')).toBeTruthy()
    expect(api.get).toHaveBeenLastCalledWith('/lab-links', {
      params: { page: 1, limit: 20, search: undefined, status: undefined },
    })

    fireEvent.click(screen.getByRole('combobox', { name: 'Filter by status' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Suspended' }))

    await waitFor(() =>
      expect(api.get).toHaveBeenLastCalledWith('/lab-links', {
        params: { page: 1, limit: 20, search: undefined, status: 'suspended' },
      }),
    )
    expect(screen.getByText('1 filter')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /clear all filters/i }),
    ).toBeTruthy()
  })

  it('shows "no results" (not the empty state) when filters match nothing', async () => {
    api.get.mockResolvedValue(page([link()]))
    renderWithClient(<LabLinksPage />)
    await screen.findByText('Precision Dental Lab')

    api.get.mockResolvedValue(page([]))
    fireEvent.change(screen.getByLabelText(/search by lab/i), {
      target: { value: 'zzz' },
    })
    expect(await screen.findByText('No labs match your filters.')).toBeTruthy()
    expect(screen.queryByText('No labs yet')).toBeNull()
  })

  it('suspending asks for a reason and sends it with the version', async () => {
    api.get.mockResolvedValue(page([link()]))
    api.post.mockResolvedValue({
      data: { data: link({ status: 'suspended', version: 4 }) },
    })
    renderWithClient(<LabLinksPage />)
    await screen.findByText('Precision Dental Lab')

    fireEvent.pointerDown(
      screen.getByRole('button', { name: 'Actions for Precision Dental Lab' }),
      { button: 0, ctrlKey: false },
    )
    fireEvent.click(await screen.findByRole('menuitem', { name: /suspend/i }))

    const dialog = await screen.findByRole('dialog')
    const confirm = within(dialog).getByRole('button', { name: 'Suspend lab' })
    fireEvent.click(confirm)
    expect(await within(dialog).findByText('A reason is required')).toBeTruthy()
    expect(api.post).not.toHaveBeenCalled()

    fireEvent.change(within(dialog).getByLabelText(/reason/i), {
      target: { value: 'Late deliveries' },
    })
    fireEvent.click(confirm)

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/lab-links/link-1/transitions', {
        action: 'suspend',
        version: 3,
        reason: 'Late deliveries',
      }),
    )
  })
})

describe('LabDirectoryPage (platform)', () => {
  it('renders labs as a table and as cards', async () => {
    api.get.mockResolvedValue(page([lab()]))
    renderWithClient(<LabDirectoryPage />)

    expect(await screen.findByText('Precision Dental Lab')).toBeTruthy()
    expect(screen.getByRole('table')).toBeTruthy()

    fireEvent.click(screen.getByTitle('Card view'))
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByText('5 clinics')).toBeTruthy()
  })

  it('opens the lab detail page from a row', async () => {
    api.get.mockResolvedValue(page([lab()]))
    renderWithClient(<LabDirectoryPage />)
    fireEvent.click(await screen.findByText('Precision Dental Lab'))
    expect(navigate).toHaveBeenCalledWith({
      to: '/lab-directory/$labId',
      params: { labId: 'lab-1' },
    })
  })
})

describe('lab schemas', () => {
  const base = {
    name: 'Lab',
    labType: 'external' as const,
    ownerOrganizationId: '',
    phone: '',
    whatsappPhone: '',
    email: '',
    city: '',
    address: '',
  }

  it('an in-house lab needs its owner clinic', () => {
    const res = labSchema.safeParse({ ...base, labType: 'internal' })
    expect(res.success).toBe(false)
    expect(res.error?.issues[0].path).toEqual(['ownerOrganizationId'])
    expect(
      labSchema.safeParse({
        ...base,
        labType: 'internal',
        ownerOrganizationId: 'org-1',
      }).success,
    ).toBe(true)
  })

  it('validates optional phone and email only when filled', () => {
    expect(labSchema.safeParse(base).success).toBe(true)
    expect(labSchema.safeParse({ ...base, phone: 'abc' }).success).toBe(false)
    expect(labSchema.safeParse({ ...base, email: 'nope' }).success).toBe(false)
  })

  it.each([
    ['30', true],
    ['0', true],
    ['365', true],
    ['366', false],
    ['-1', false],
    ['1.5', false],
    ['', false],
  ])('payment terms %p → valid %p', (days, ok) => {
    expect(
      labLinkSchema.safeParse({
        labId: '',
        paymentTermsDays: days,
        patientDataLevel: 'full_name',
        notes: '',
      }).success,
    ).toBe(ok)
  })
})
