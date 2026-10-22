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

import { LabServicesPanel } from './components/LabServicesPanel'
import { formatPaisa, paisaToRupeesText, rupeesToPaisa } from './lib/money'
import { LabCatalogPage } from './pages/LabCatalogPage'
import { OrderTemplatesPage } from './pages/OrderTemplatesPage'
import { orderTemplateSchema, priceSchema } from './schemas/catalog.schema'
import type {
  ClinicServiceRow,
  OrderTemplate,
  PlatformServiceRow,
  PriceWindow,
  ServiceMapping,
} from './types'

// ── Mocks: API transport, router, toasts, page chrome, access ────────────
const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
}))
vi.mock('@/lib/api', () => ({ default: api, apiClient: api }))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
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
const granted = vi.hoisted(() => ({ perms: new Set<string>() }))
vi.mock('@/features/access', () => ({
  useAccess: () => ({
    isLoading: false,
    can: (p: string | string[]) =>
      (Array.isArray(p) ? p : [p]).some((k) => granted.perms.has(k)),
  }),
}))

const ok = <T,>(data: T) => ({ data: { data } })
const page = <T,>(data: T[]) =>
  ok({ data, total: data.length, page: 1, limit: 20, totalPages: 1 })

const ref = (code: string) => ({ id: `${code}-id`, code, name: code })

const baseService = {
  id: 'svc-1',
  labId: 'lab-1',
  specialty: ref('DENTAL'),
  category: { id: 'cat-1', code: 'CROWN', name: 'Crowns' },
  code: 'ZR_CROWN',
  name: 'Zirconia crown',
  description: null,
  unitType: 'per_tooth' as const,
  defaultTurnaroundDays: 5,
  formSchema: ref('CROWN'),
  workflowTemplate: ref('DENTAL_ITEM'),
  stageTemplate: null,
  isActive: true,
  options: [],
  version: 1,
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
}

const clinicRow = (over: Partial<ClinicServiceRow> = {}): ClinicServiceRow => ({
  ...baseService,
  lab: { id: 'lab-1', name: 'Precision Dental Lab', city: 'Karachi' },
  linkStatus: 'active',
  price: {
    priceId: 'p-1',
    source: 'negotiated',
    unitPricePaisa: 450_000,
    rushSurchargePaisa: 100_000,
    currency: 'PKR',
    effectiveFrom: '2026-10-01',
    effectiveTo: null,
  },
  mapping: {
    id: 'map-1',
    clinicTreatmentId: 't-1',
    clinicTreatmentName: 'Zirconia crown (patient)',
    isDefault: true,
  },
  patientPricePaisa: 1_500_050,
  ...over,
})

const mapping = (over: Partial<ServiceMapping> = {}): ServiceMapping => ({
  id: 'map-1',
  clinicTreatment: {
    id: 't-1',
    name: 'Zirconia crown (patient)',
    code: 'ZRC',
    isActive: true,
    defaultPricePaisa: 1_200_000,
  },
  labService: {
    id: 'svc-1',
    code: 'ZR_CROWN',
    name: 'Zirconia crown',
    unitType: 'per_tooth',
    isActive: true,
    lab: { id: 'lab-1', name: 'Precision Dental Lab' },
  },
  isDefault: true,
  isActive: true,
  version: 2,
  createdAt: '2026-10-01T10:00:00.000Z',
  ...over,
})

const template = (over: Partial<OrderTemplate> = {}): OrderTemplate => ({
  id: 'tpl-1',
  name: 'Clinic crown',
  shared: true,
  owner: null,
  specialtyId: 'DENTAL-id',
  lab: { id: 'lab-1', name: 'Precision Dental Lab' },
  body: {
    schemaVersion: 1,
    items: [
      {
        labServiceId: 'svc-1',
        optionIds: [],
        quantity: 2,
        rush: false,
        formCode: 'CROWN',
        answers: {},
      },
    ],
    notes: null,
  },
  useCount: 4,
  lastUsedAt: null,
  isActive: true,
  canEdit: false,
  version: 1,
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
  ...over,
})

/** Routes GETs by URL; anything unknown resolves to an empty list. */
function routeGets(routes: Record<string, unknown>) {
  api.get.mockImplementation((url: string) => {
    const hit = Object.entries(routes).find(([prefix]) => url === prefix)
    return Promise.resolve(hit ? hit[1] : ok([]))
  })
}

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  vi.clearAllMocks()
  granted.perms = new Set(['lab.orders.create'])
})

describe('money helpers (integer paisa)', () => {
  it('converts typed rupees to paisa without floats', () => {
    expect(rupeesToPaisa('4500')).toBe(450_000)
    expect(rupeesToPaisa('4500.5')).toBe(450_050)
    expect(rupeesToPaisa('0.07')).toBe(7)
    expect(rupeesToPaisa('1.005')).toBeNull()
    expect(rupeesToPaisa('-5')).toBeNull()
    expect(rupeesToPaisa('abc')).toBeNull()
    expect(paisaToRupeesText(450_050)).toBe('4500.5')
    expect(formatPaisa(1_500_050)).toBe('PKR 15,000.50')
  })
})

describe('schemas', () => {
  it('price: amount required, end on/after start', () => {
    const base = {
      organizationId: '',
      unitPrice: '4500',
      rushSurcharge: '',
      effectiveFrom: '2026-11-01',
      effectiveTo: '',
      notes: '',
    }
    expect(priceSchema.safeParse(base).success).toBe(true)
    expect(
      priceSchema.safeParse({ ...base, unitPrice: '45.123' }).success,
    ).toBe(false)
    expect(
      priceSchema.safeParse({ ...base, effectiveTo: '2026-10-31' }).success,
    ).toBe(false)
  })

  it('template: needs a name and at least one service', () => {
    const item = {
      labServiceId: 'svc-1',
      optionIds: [],
      quantity: '1',
      rush: false,
      answers: {},
    }
    expect(
      orderTemplateSchema.safeParse({
        name: 'Crown',
        shared: false,
        notes: '',
        items: [item],
      }).success,
    ).toBe(true)
    expect(
      orderTemplateSchema.safeParse({
        name: '',
        shared: false,
        notes: '',
        items: [],
      }).success,
    ).toBe(false)
    expect(
      orderTemplateSchema.safeParse({
        name: 'Crown',
        shared: false,
        notes: '',
        items: [{ ...item, quantity: '0' }],
      }).success,
    ).toBe(false)
  })
})

describe('LabCatalogPage (clinic price list)', () => {
  it('shows lab cost, patient price and margin per service', async () => {
    routeGets({ '/lab-catalog/services': page([clinicRow()]) })
    renderWithClient(<LabCatalogPage />)

    const row = (await screen.findByText('Zirconia crown')).closest('tr')!
    const cells = within(row)
    expect(cells.getByText('PKR 4,500')).toBeTruthy()
    expect(cells.getByText('Your rate')).toBeTruthy()
    expect(cells.getByText('PKR 15,000.50')).toBeTruthy()
    // 15,000.50 − 4,500 = 10,500.50 per unit
    expect(cells.getByText('PKR 10,500.50')).toBeTruthy()
    expect(api.get).toHaveBeenCalledWith('/lab-catalog/services', {
      params: {
        page: 1,
        limit: 20,
        search: undefined,
        labId: undefined,
        categoryId: undefined,
        mapped: undefined,
      },
    })
  })

  it('filters to unmapped services and shows the no-results state', async () => {
    routeGets({ '/lab-catalog/services': page([clinicRow()]) })
    renderWithClient(<LabCatalogPage />)
    await screen.findByText('Zirconia crown')

    routeGets({ '/lab-catalog/services': page([]) })
    fireEvent.click(screen.getByRole('combobox', { name: 'Filter by mapping' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Not mapped' }))

    await waitFor(() =>
      expect(api.get).toHaveBeenLastCalledWith('/lab-catalog/services', {
        params: expect.objectContaining({ mapped: false }),
      }),
    )
    expect(
      await screen.findByText('No services match your filters.'),
    ).toBeTruthy()
  })

  it('shows the empty state when no lab has a catalog yet', async () => {
    routeGets({ '/lab-catalog/services': page([]) })
    renderWithClient(<LabCatalogPage />)
    expect(await screen.findByText('No lab services yet')).toBeTruthy()
  })

  it('removing a mapping is confirmed, then deactivates it', async () => {
    routeGets({
      '/lab-catalog/services': page([]),
      '/lab-catalog/mappings': ok([mapping()]),
    })
    api.patch.mockResolvedValue(ok(mapping({ isActive: false })))
    renderWithClient(<LabCatalogPage />)

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Treatment mapping' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Treatment mapping' }))
    expect(await screen.findByText('Zirconia crown (patient)')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Remove mapping' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(api.patch).not.toHaveBeenCalled()
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Remove mapping' }),
    )
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/lab-catalog/mappings/map-1', {
        isDefault: undefined,
        isActive: false,
        version: 2,
      }),
    )
  })
})

describe('OrderTemplatesPage', () => {
  it('shows the empty state with a call to action', async () => {
    routeGets({ '/lab-catalog/order-templates': page([]) })
    renderWithClient(<OrderTemplatesPage />)
    expect(await screen.findByText('No templates yet')).toBeTruthy()
    expect(
      screen.getAllByRole('button', { name: /new template/i }).length,
    ).toBe(2)
  })

  it('lists shared templates; only editable ones get edit controls', async () => {
    routeGets({
      '/lab-catalog/order-templates': page([
        template(),
        template({
          id: 'tpl-2',
          name: 'My crown',
          shared: false,
          owner: { id: 'u-1', name: 'Dr Sara' },
          canEdit: true,
        }),
      ]),
    })
    renderWithClient(<OrderTemplatesPage />)
    expect(await screen.findByText('Clinic crown')).toBeTruthy()
    expect(screen.getByText('Shared')).toBeTruthy()
    expect(screen.getAllByText(/1 service · 2 units/)).toHaveLength(2)
    expect(
      screen.queryByRole('button', { name: 'Edit Clinic crown' }),
    ).toBeNull()
    expect(screen.getByRole('button', { name: 'Edit My crown' })).toBeTruthy()
  })

  it('hides the share switch without lab.templates.share', async () => {
    routeGets({ '/lab-catalog/order-templates': page([]) })
    renderWithClient(<OrderTemplatesPage />)
    fireEvent.click(
      (await screen.findAllByRole('button', { name: /new template/i }))[0],
    )
    expect(await screen.findByText('New order template')).toBeTruthy()
    expect(screen.getByText('Services')).toBeTruthy()
    expect(screen.queryByText('Share with the whole clinic')).toBeNull()
  })

  it('shows the share switch with lab.templates.share', async () => {
    granted.perms = new Set(['lab.orders.create', 'lab.templates.share'])
    routeGets({ '/lab-catalog/order-templates': page([]) })
    renderWithClient(<OrderTemplatesPage />)
    fireEvent.click(
      (await screen.findAllByRole('button', { name: /new template/i }))[0],
    )
    expect(await screen.findByText('New order template')).toBeTruthy()
    expect(screen.getByText('Share with the whole clinic')).toBeTruthy()
  })
})

describe('LabServicesPanel (platform)', () => {
  const svc = (over: Partial<PlatformServiceRow> = {}): PlatformServiceRow => ({
    ...baseService,
    listPrice: {
      priceId: 'p-list',
      source: 'list',
      unitPricePaisa: 500_000,
      rushSurchargePaisa: 0,
      currency: 'PKR',
      effectiveFrom: '2026-10-01',
      effectiveTo: null,
    },
    negotiatedPriceCount: 3,
    ...over,
  })
  const listPrice: PriceWindow = {
    id: 'p-list',
    labServiceId: 'svc-1',
    organization: null,
    unitPricePaisa: 500_000,
    rushSurchargePaisa: 100_000,
    currency: 'PKR',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    notes: null,
    voidedAt: null,
    voidReason: null,
    version: 1,
    createdAt: '2026-01-01T10:00:00.000Z',
  }

  it('lists services with the list price and clinic-rate count', async () => {
    routeGets({ '/platform/labs/lab-1/services': page([svc()]) })
    renderWithClient(<LabServicesPanel labId="lab-1" />)
    const row = (await screen.findByText('Zirconia crown')).closest('tr')!
    expect(within(row).getByText('PKR 5,000')).toBeTruthy()
    expect(within(row).getByText('List price')).toBeTruthy()
    expect(within(row).getByText('3')).toBeTruthy()
  })

  it('opens options & prices; a running price can only be ended, not voided', async () => {
    routeGets({
      '/platform/labs/lab-1/services': page([svc()]),
      '/platform/labs/lab-1/services/svc-1/prices': ok([listPrice]),
    })
    renderWithClient(<LabServicesPanel labId="lab-1" />)
    fireEvent.click(await screen.findByText('Zirconia crown'))

    expect(await screen.findByText('In use')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Set an end date' })).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Void — it never takes effect' }),
    ).toBeNull()
  })

  it('shows the empty state with an add button', async () => {
    routeGets({ '/platform/labs/lab-1/services': page([]) })
    renderWithClient(<LabServicesPanel labId="lab-1" />)
    expect(await screen.findByText('No services yet')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /add service/i }).length).toBe(
      2,
    )
  })
})
