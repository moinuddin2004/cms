import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import type * as ApiModule from '@/lib/api'
import { useAuthStore } from '@/store/useAuthStore'
import type { LabMembership } from '@/store/useAuthStore'
import { LabProductionPage } from './LabProductionPage'
import { dispatchSchema } from './schemas'
import { nextLabStep } from './types'
import type { LabProductionItem } from './types'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }))
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>()
  return { ...actual, default: api }
})
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
  useRouterState: () => '/lab-portal/production',
}))
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

const LAB: LabMembership = {
  labId: 'lab-a',
  labName: 'Precision Dental Lab',
  labType: 'external',
  city: 'Karachi',
  role: 'lab_admin',
}

const item = (over: Partial<LabProductionItem> = {}): LabProductionItem => ({
  id: 'i1',
  orderId: 'o1',
  orderNo: 'LAB-0007',
  priority: 'normal',
  lineNo: 1,
  serviceName: 'PFM bridge',
  quantity: 1,
  status: 'accepted',
  remakeOfItemId: null,
  version: 2,
  labExpectedOn: '2026-10-27',
  clinic: { name: 'Bright Smiles' },
  patient: { ref: 'Sana Iqbal' },
  activeStage: null,
  stageCount: 3,
  assignee: null,
  ...over,
})

const ok = <T,>(data: T) => ({ data: { data } })

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.getState().setAuth({
    user: { uuid: 'me', email: 'me@lab.test', name: 'Me', globalRole: null },
    accessToken: 'token',
    accessibleOrganizations: [],
    activeOrganizationId: null,
    activeLocationId: null,
    labMemberships: [LAB],
  })
})

describe('nextLabStep', () => {
  const stage = (status: string, isFinal = false) => ({
    id: 's',
    name: 'Metal try-in',
    roundNo: 1,
    status,
    isFinal,
  })
  it('follows the item and its active stage', () => {
    expect(nextLabStep(item())).toBe('start')
    expect(
      nextLabStep(
        item({ status: 'in_production', activeStage: stage('at_lab') }),
      ),
    ).toBe('ship_tryin')
    expect(
      nextLabStep(
        item({ status: 'in_production', activeStage: stage('at_lab', true) }),
      ),
    ).toBe('finish')
    expect(
      nextLabStep(
        item({ status: 'in_production', activeStage: stage('sent_to_clinic') }),
      ),
    ).toBeNull()
    expect(nextLabStep(item({ status: 'in_production', stageCount: 0 }))).toBe(
      'finish',
    )
    expect(nextLabStep(item({ status: 'qc' }))).toBe('qc')
    expect(nextLabStep(item({ status: 'ready' }))).toBe('ship_final')
    expect(nextLabStep(item({ status: 'delivered' }))).toBeNull()
  })
})

describe('dispatchSchema', () => {
  it('needs at least one item', () => {
    expect(
      dispatchSchema.safeParse({
        itemIds: [],
        courierName: '',
        trackingNo: '',
        notes: '',
      }).success,
    ).toBe(false)
  })
})

describe('LabProductionPage', () => {
  it('lists the work queue and starts work on an item', async () => {
    api.get.mockImplementation((url: string) =>
      Promise.resolve(
        url.endsWith('/items')
          ? ok({ data: [item()], total: 1, page: 1, limit: 25 })
          : ok([]),
      ),
    )
    api.post.mockResolvedValue(ok(null))
    renderWithClient(<LabProductionPage />)
    expect(await screen.findByText(/LAB-0007 \/ 1/)).toBeTruthy()
    expect(screen.getByText(/Bright Smiles · Sana Iqbal/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Start work/ }))
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/lab-portal/production/items/i1/start',
        {},
      ),
    )
  })

  it('shows the empty state when nothing is in production', async () => {
    api.get.mockResolvedValue(ok({ data: [], total: 0, page: 1, limit: 25 }))
    renderWithClient(<LabProductionPage />)
    expect(await screen.findByText('No work yet')).toBeTruthy()
  })
})
