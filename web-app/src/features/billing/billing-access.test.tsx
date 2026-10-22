import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { createAccessChecks } from '@/features/access/lib/access'
import {
  AccessContext,
  DISABLED_ACCESS,
} from '@/features/access/lib/access-context'
import type { MeAccess, PermissionKey } from '@/features/access'
import { DiscountSheet } from './components/charges/DiscountSheet'
import { EditChargeSheet } from './components/charges/EditChargeSheet'
import type { Charge, DiscountType } from './types/billing.types'

// The first render pays for loading the sheet / form modules.
vi.setConfig({ testTimeout: 30_000 })

// ── Mocks: page shell, billing queries / mutations, the searchable select ─
vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}))
const senior: DiscountType = {
  id: 'dt1',
  name: 'Senior citizen',
  code: null,
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
} as DiscountType

vi.mock('./hooks/use-billing-queries', () => ({
  useDiscountTypes: () => ({ data: [senior], isLoading: false }),
}))
vi.mock('./hooks/use-billing-mutation', () => ({
  useBillingMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('./components/shared/OptionSelect', () => ({
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

function withAccess(perms: PermissionKey[], ui: ReactNode) {
  const data = {
    version: 1,
    organizationId: 'org1',
    locationId: 'loc1',
    isSuperAdmin: false,
    isOwner: false,
    features: ['billing.invoices', 'billing.discounts'],
    permissions: Object.fromEntries(perms.map((p) => [p, true])),
    roles: [],
    employeeId: 'emp1',
    homeRoute: null,
    nav: null,
  } as MeAccess
  return render(
    <AccessContext.Provider
      value={{
        ...DISABLED_ACCESS,
        ...createAccessChecks(data),
        status: 'ready',
        version: 1,
      }}
    >
      {ui}
    </AccessContext.Provider>,
  )
}

const sheet = <DiscountSheet chargeIds={['c1']} open onOpenChange={() => {}} />

describe('DiscountSheet gating', () => {
  it('hides the custom discount switch without billing.discount.custom', () => {
    withAccess(['billing.desk.use', 'billing.discount.apply'], sheet)
    expect(screen.queryByLabelText('Custom discount')).toBeNull()
  })

  it('shows the custom discount switch with billing.discount.custom', () => {
    withAccess(['billing.desk.use', 'billing.discount.custom'], sheet)
    expect(screen.getByLabelText('Custom discount')).toBeTruthy()
  })

  it('limits a preset to its range without billing.discount.custom', () => {
    withAccess(['billing.discount.apply'], sheet)
    fireEvent.change(screen.getByLabelText('option-select'), {
      target: { value: 'dt1' },
    })
    expect(screen.getByText('Value (5–15)')).toBeTruthy()
  })

  it('offers any value of a preset with billing.discount.custom', () => {
    withAccess(['billing.discount.custom'], sheet)
    fireEvent.change(screen.getByLabelText('option-select'), {
      target: { value: 'dt1' },
    })
    expect(screen.getByText('Value (optional)')).toBeTruthy()
    expect(screen.queryByText('Value (5–15)')).toBeNull()
  })
})

describe('EditChargeSheet price gating', () => {
  const charge = {
    id: 'c1',
    serviceId: 'svc1',
    needsPricing: false,
    description: 'Scaling',
    quantity: 1,
    unitPrice: 1000,
  } as Charge

  const priceInput = () => screen.getByLabelText<HTMLInputElement>(/Unit price/)

  it('locks a catalog price without billing.price.override', () => {
    withAccess(
      ['billing.desk.use'],
      <EditChargeSheet charge={charge} open onOpenChange={() => {}} />,
    )
    expect(priceInput().disabled).toBe(true)
  })

  it('unlocks it with billing.price.override', () => {
    withAccess(
      ['billing.desk.use', 'billing.price.override'],
      <EditChargeSheet charge={charge} open onOpenChange={() => {}} />,
    )
    expect(priceInput().disabled).toBe(false)
  })
})
