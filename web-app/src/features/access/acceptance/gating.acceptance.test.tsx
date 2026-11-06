import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useAuthStore } from '@/store/useAuthStore'
import { AccessContext } from '../lib/access-context'
import { createAccessChecks } from '../lib/access'
import { RouteAccessGate } from '../components/RouteAccessGate'
import { accessValue, meFor, renderAs } from './actors'
import type { ActorName } from './actors'
import { DiscountSheet } from '@/features/billing/components/charges/DiscountSheet'
import { InvoiceDetailPage } from '@/features/billing/pages/InvoiceDetailPage'
import { queuePermissionsFrom } from '@/features/queue/hooks/useQueuePermissions'
import { QueueEntryActions } from '@/features/queue/components/QueueEntryActions'
import type { QueueEntry } from '@/features/queue/types'
import { visiblePatientTabs } from '@/features/patients/utils/patientTabs'
import { useSettingsItems } from '@/features/settings/hooks/useSettingsItems'
import { UsersPage } from '@/features/users/pages/UsersPage'
import { ClinicOverviewPage } from '@/features/reports/pages/ClinicOverviewPage'
import { OrderTemplatesPage } from '@/features/lab-catalog/pages/OrderTemplatesPage'

vi.setConfig({ testTimeout: 60_000 })

// ── Mocks: API, router, shell, toasts, billing data hooks ──────────────────────
const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}))
vi.mock('@/lib/api', () => ({ default: api, apiClient: api }))
const router = vi.hoisted(() => ({
  matches: [] as { staticData: { can?: unknown } }[],
}))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  Navigate: () => null,
  useNavigate: () => vi.fn(),
  useMatches: () => router.matches,
}))
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))
vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({
    actions,
    children,
  }: {
    actions?: ReactNode
    children: ReactNode
  }) => (
    <main>
      {actions}
      {children}
    </main>
  ),
}))
vi.mock('@/context/FeatureFlagsContext', () => ({
  useFeatures: () => ({ features: new Set<string>(), isLoading: false }),
}))
vi.mock('@/features/appointments', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useDoctors: () => ({ data: [] }),
}))

const invoice = {
  id: 'inv1',
  invoiceNumber: 'INV-1',
  status: 'ISSUED',
  paymentStatus: 'UNPAID',
  refundStatus: 'NONE',
  revision: 1,
  issueDate: '2026-10-22',
  dueDate: '2026-10-29',
  subtotal: 500,
  discountTotal: 0,
  totalAmount: 500,
  paidAmount: 0,
  balanceDue: 500,
  refundableAmount: 100,
  refundedAmount: 0,
  patient: { id: 'p1', name: 'Ali' },
  charges: [],
  payments: [],
  refunds: [],
  revisions: [],
}
const senior = {
  id: 'dt1',
  name: 'Senior citizen',
  kind: 'PERCENTAGE',
  value: 10,
  maxAmount: null,
  appliesTo: 'ALL',
  serviceKinds: null,
  serviceIds: null,
  receptionEditable: true,
  minValue: 5,
  maxValue: 15,
  requiresNote: false,
  validFrom: null,
  validTo: null,
  isActive: true,
}
vi.mock('@/features/billing/hooks/use-billing-queries', () => ({
  useInvoiceDetail: () => ({
    data: invoice,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useDiscountTypes: () => ({ data: [senior], isLoading: false }),
}))
vi.mock('@/features/billing/hooks/use-billing-mutation', () => ({
  useBillingMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/features/billing/components/shared/OptionSelect', () => ({
  OptionSelect: ({
    options,
    value,
    onChange,
  }: {
    options: { value: string; label: string }[]
    value: string
    onChange: (v: string) => void
  }) => (
    <select
      aria-label="option-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="" />
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}))
vi.mock('@/features/billing/components/collect-payment/CollectPaymentSheet', () => ({
  CollectPaymentSheet: () => null,
}))
vi.mock('@/features/billing/components/invoices/EditInvoiceSheet', () => ({
  EditInvoiceSheet: () => null,
}))
vi.mock('@/features/billing/components/refunds/RefundSheet', () => ({
  RefundSheet: () => null,
}))
vi.mock('@/features/billing/components/shared/ReasonDialog', () => ({
  ReasonDialog: () => null,
}))
vi.mock('@/features/billing/components/print/PrintButton', () => ({
  PrintButton: () => null,
}))

const wrap = (ui: ReactNode) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>
}

/** `staticData.can` of a route file, read from source (routes are the contract). */
function routeCan(file: string): string | string[] {
  const src = readFileSync(join(__dirname, '../../../routes', file), 'utf8')
  const m = /staticData:\s*\{\s*can:\s*(\[[^\]]*\]|'[^']*')/.exec(src)
  if (!m) throw new Error(`${file} declares no staticData.can`)
  return JSON.parse(m[1].replace(/'/g, '"')) as string | string[]
}

beforeEach(() => {
  vi.clearAllMocks()
  router.matches = []
  useAuthStore.setState({
    activeOrganizationId: 'orgA',
    activeLocationId: 'L1',
    labMemberships: [],
  } as never)
})

const NO_ACCESS = 'You have no access to this page'

describe('UI — route gate', () => {
  it('UI-01 RecU opens /payroll, /finance, /settings/roles → NoAccess page (not blank, not a crash)', () => {
    for (const file of ['payroll.tsx', 'finance.tsx', 'settings.roles.index.tsx']) {
      router.matches = [{ staticData: { can: routeCan(file) } }]
      const { unmount } = renderAs(
        'RecU',
        <RouteAccessGate>
          <span>secret page</span>
        </RouteAccessGate>,
      )
      expect(screen.queryByText('secret page')).toBeNull()
      expect(screen.getByText(NO_ACCESS)).toBeTruthy()
      expect(screen.getByRole('link', { name: 'Go to my home page' })).toBeTruthy()
      unmount()
    }
    // …and the owner opens them.
    router.matches = [{ staticData: { can: routeCan('payroll.tsx') } }]
    renderAs(
      'OwnerA',
      <RouteAccessGate>
        <span>secret page</span>
      </RouteAccessGate>,
    )
    expect(screen.getByText('secret page')).toBeTruthy()
  })

  it('UI-02 while /me/access is loading → LoadingSkeleton (neither the page nor NoAccess)', () => {
    router.matches = [{ staticData: { can: 'payroll.manage' } }]
    const { container } = renderAs(
      'RecU',
      <RouteAccessGate>
        <span>secret page</span>
      </RouteAccessGate>,
      { status: 'loading', isLoading: true },
    )
    expect(container.querySelector('[data-slot="skeleton"]')).toBeTruthy()
    expect(screen.queryByText('secret page')).toBeNull()
    expect(screen.queryByText(NO_ACCESS)).toBeNull()
  })

  it('UI-03 /me/access 500 → error state with retry', () => {
    router.matches = [{ staticData: { can: 'payroll.manage' } }]
    const refetch = vi.fn()
    renderAs(
      'RecU',
      <RouteAccessGate>
        <span>secret page</span>
      </RouteAccessGate>,
      { status: 'error', isError: true, refetch },
    )
    expect(screen.getByText("Couldn't load your access")).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /try again|retry/i }))
    expect(refetch).toHaveBeenCalled()
    expect(screen.queryByText('secret page')).toBeNull()
  })
})

describe('UI — buttons and sections follow the permission', () => {
  it('UI-04 RecU on an invoice detail: void / refund hidden, collect visible', () => {
    renderAs('RecU', wrap(<InvoiceDetailPage invoiceId="inv1" />))
    expect(screen.queryByRole('button', { name: /Cancel/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Refund/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Collect payment/ })).toBeTruthy()
  })

  it('UI-04b the accountant sees void + refund (control)', () => {
    renderAs('AcctU', wrap(<InvoiceDetailPage invoiceId="inv1" />))
    expect(screen.getByRole('button', { name: /Cancel/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Refund/ })).toBeTruthy()
  })

  it('UI-05 discount sheet: RecU limited to the preset range; AdminU may go outside', () => {
    const sheet = <DiscountSheet chargeIds={['c1']} open onOpenChange={() => {}} />
    const rec = renderAs('RecU', sheet)
    expect(screen.queryByLabelText('Custom discount')).toBeNull()
    fireEvent.change(screen.getByLabelText('option-select'), {
      target: { value: 'dt1' },
    })
    expect(screen.getByText('Value (5–15)')).toBeTruthy()
    rec.unmount()

    renderAs('AdminU', sheet)
    expect(screen.getByLabelText('Custom discount')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('option-select'), {
      target: { value: 'dt1' },
    })
    expect(screen.getByText('Value (optional)')).toBeTruthy()
    expect(screen.queryByText('Value (5–15)')).toBeNull()
  })

  it('UI-06 queue actions: Doc1 has no reprioritize; AdminU has it', async () => {
    const entry = {
      id: 'e1',
      sessionId: 's1',
      token: 'A-001',
      tokenNumber: 1,
      queueType: 'walk_in',
      status: 'waiting',
      priorityClass: 'normal',
      patient: { id: 'p1', fullName: 'Pat', phone: null, patientNumber: null },
      checkedInAt: '2026-10-12T09:00:00.000Z',
      sortAnchorAt: '2026-10-12T09:00:00.000Z',
      version: 1,
    } as unknown as QueueEntry
    const flags = (who: ActorName) =>
      queuePermissionsFrom(accessValue(meFor(who)))
    expect(flags('Doc1').canReprioritize).toBe(false)
    expect(flags('AdminU').canReprioritize).toBe(true)

    const open = async (who: ActorName) => {
      const { unmount } = renderAs(
        who,
        wrap(
          <QueueEntryActions
            entry={entry}
            doctorId="d1"
            role={flags(who)}
            rejoinPolicy="end"
            waiting={[]}
            handlers={{
              onCancel: vi.fn(),
              onUrgent: vi.fn(),
              onTransfer: vi.fn(),
            }}
          />,
        ),
      )
      const trigger = screen.getByRole('button', { name: 'Actions for A-001' })
      fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })
      fireEvent.click(trigger)
      const urgent = await screen.findAllByText(/Print ticket/)
      expect(urgent.length).toBeGreaterThan(0)
      const hasUrgent = !!screen.queryByText('Urgent priority')
      unmount()
      return hasUrgent
    }
    expect(await open('Doc1')).toBe(false)
    expect(await open('AdminU')).toBe(true)
  })

  it('UI-07 patient tabs: Doc1 has no billing tab; RecU has the billing tab', () => {
    const tabs = (who: ActorName) =>
      visiblePatientTabs(createAccessChecks(meFor(who)))
    expect(tabs('Doc1')).not.toContain('billing')
    expect(tabs('Doc1')).toContain('clinical')
    expect(tabs('RecU')).toContain('billing')
    expect(tabs('RecU')).not.toContain('clinical')
  })

  it('UI-08 lab template share: Doc1 has no share action; AdminU does', async () => {
    // Access goes through the real useAccess() → the actor's context.
    api.get.mockImplementation(() =>
      Promise.resolve({
        data: {
          data: { data: [], total: 0, page: 1, limit: 20, totalPages: 1 },
        },
      }),
    )
    const open = async (who: ActorName) => {
      const { unmount } = renderAs(who, wrap(<OrderTemplatesPage />))
      fireEvent.click(
        (await screen.findAllByRole('button', { name: /new template/i }))[0],
      )
      await screen.findByText('New order template')
      const share = !!screen.queryByText('Share with the whole clinic')
      unmount()
      return share
    }
    expect(await open('Doc1')).toBe(false)
    expect(await open('AdminU')).toBe(true)
  })

  it('UI-09 settings pages: RecU none of Billing / Notifications / Theme; AdminU all', () => {
    function SettingsLinks() {
      const items = useSettingsItems().flatMap((g) => g.items)
      return (
        <>
          {items.map((i) => (
            <a key={i.key} href={i.href}>
              {i.label}
            </a>
          ))}
        </>
      )
    }
    const links = () => ({
      billing: !!screen.queryByRole('link', {
        name: 'Services, prices & payments',
      }),
      notifications: !!screen.queryByRole('link', { name: 'Notifications' }),
      theme: !!screen.queryByRole('link', { name: 'Branding & theme' }),
    })
    const rec = renderAs('RecU', <SettingsLinks />)
    expect(links()).toEqual({ billing: false, notifications: false, theme: false })
    rec.unmount()
    renderAs('AdminU', <SettingsLinks />)
    expect(links()).toEqual({ billing: true, notifications: true, theme: true })
  })

  it('UI-10 users page: RecU → NoAccess; AdminU → the page', async () => {
    router.matches = [{ staticData: { can: routeCan('settings.users.tsx') } }]
    api.get.mockResolvedValue({
      data: { data: [], total: 0, page: 1, limit: 10, totalPages: 0 },
    })
    const rec = renderAs(
      'RecU',
      wrap(
        <RouteAccessGate>
          <UsersPage />
        </RouteAccessGate>,
      ),
    )
    expect(screen.getByText(NO_ACCESS)).toBeTruthy()
    rec.unmount()
    renderAs(
      'AdminU',
      wrap(
        <RouteAccessGate>
          <UsersPage />
        </RouteAccessGate>,
      ),
    )
    expect(screen.queryByText(NO_ACCESS)).toBeNull()
  })
})

describe('SCOPE-10 (UI half)', () => {
  it('Doc1 opens the clinic overview: API 403 → the page shows its error state', async () => {
    api.get.mockRejectedValue(
      Object.assign(new Error('Forbidden'), {
        response: { status: 403, data: { error: { code: 'NO_PERMISSION' } } },
      }),
    )
    renderAs('Doc1', wrap(<ClinicOverviewPage />))
    expect(
      await screen.findByRole('button', { name: /try again|retry/i }),
    ).toBeTruthy()
    expect(screen.queryByText('Patients seen')).toBeNull()
  })
})

void AccessContext
void render
