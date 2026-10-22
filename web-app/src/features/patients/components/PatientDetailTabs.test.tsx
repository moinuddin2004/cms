import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { createAccessChecks } from '@/features/access/lib/access'
import {
  AccessContext,
  DISABLED_ACCESS,
} from '@/features/access/lib/access-context'
import type { AccessContextValue } from '@/features/access/lib/access-context'
import type { MeAccess } from '@/features/access'
import type { Patient } from '../types'
import { visiblePatientTabs } from '../utils/patientTabs'
import { PatientDetailTabs } from './PatientDetailTabs'

// Tab bodies fetch data; the gating is what is under test here.
const { stub } = vi.hoisted(() => ({
  stub: (name: string) =>
    function Stub() {
      return <div data-testid={`body-${name}`} />
    },
}))
vi.mock('./tabs/OverviewTab', () => ({ OverviewTab: stub('overview') }))
vi.mock('./tabs/AppointmentsTab', () => ({
  AppointmentsTab: stub('appointments'),
}))
vi.mock('./tabs/VisitsTab', () => ({ VisitsTab: stub('visits') }))
vi.mock('./tabs/TreatmentsTab', () => ({ TreatmentsTab: stub('treatments') }))
vi.mock('./tabs/VitalsAndDentalTab', () => ({
  VitalsAndDentalTab: stub('vitals'),
}))
vi.mock('./tabs/TeethChartTab', () => ({ TeethChartTab: stub('chart') }))
vi.mock('./tabs/ClinicalTab', () => ({ ClinicalTab: stub('clinical') }))
vi.mock('./tabs/ConsentsTab', () => ({ ConsentsTab: stub('consents') }))
vi.mock('./tabs/FilesTab', () => ({ FilesTab: stub('files') }))
vi.mock('@/features/billing', () => ({ PatientBillingTab: stub('billing') }))
vi.mock('@/features/notifications', () => ({
  PatientMessagesCard: stub('messages'),
}))
// The access barrel → RouteAccessGate → DashboardLayout → Sidebar → access barrel cycle.
vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: stub('layout'),
}))

type Grants = MeAccess['permissions']

function access(
  permissions: Grants,
  features: string[] = [],
): AccessContextValue {
  const data: MeAccess = {
    version: 1,
    organizationId: 'org1',
    locationId: 'loc1',
    isSuperAdmin: false,
    isOwner: false,
    features,
    permissions,
    roles: [],
    employeeId: 'emp1',
    homeRoute: null,
    nav: null,
  }
  return { ...DISABLED_ACCESS, ...createAccessChecks(data), status: 'ready' }
}

const ALL_FEATURES = ['patients.teeth_chart', 'patients.prescriptions']

// Role templates from the backend catalog (permissions as /me/access returns them).
const DOCTOR: Grants = {
  'patients.view': 'own',
  'patients.clinical.view': true,
  'patients.clinical.edit': true,
  'patients.chart.edit': true,
  'patients.documents.manage': true,
  'plans.manage': true,
  'appointments.view': 'own',
  'prescriptions.create': true,
}
const RECEPTIONIST: Grants = {
  'patients.view': 'location',
  'patients.create': true,
  'patients.edit': true,
  'patients.price.view': true,
  'patients.documents.manage': true,
  'appointments.view': 'location',
  'billing.invoice.view': 'location',
}

const patient = {
  id: 'p1',
  fullName: 'Ali Khan',
  phone: '0300',
  patientNumber: 'P-1',
} as Patient

function renderTabs(value: AccessContextValue) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <AccessContext.Provider value={value}>{children}</AccessContext.Provider>
  )
  render(<PatientDetailTabs patient={patient} />, { wrapper: Wrapper })
  return screen.getAllByRole('tab').map((t) => t.textContent)
}

describe('visiblePatientTabs', () => {
  it('doctor: clinical tabs, no billing', () => {
    expect(visiblePatientTabs(access(DOCTOR, ALL_FEATURES))).toEqual([
      'overview',
      'appointments',
      'visits',
      'treatments',
      'vitals-dental',
      'teeth-chart',
      'clinical',
      'consents',
      'files',
    ])
  })

  it('receptionist: billing and files, no clinical records', () => {
    expect(visiblePatientTabs(access(RECEPTIONIST, ALL_FEATURES))).toEqual([
      'overview',
      'appointments',
      'billing',
      'files',
    ])
  })

  it('a permission needs nothing else; clinical-view tabs also need their feature', () => {
    const a = access({ 'patients.view': 'org', 'patients.clinical.view': true })
    const tabs = visiblePatientTabs(a)
    expect(tabs).toContain('vitals-dental')
    expect(tabs).not.toContain('teeth-chart')
    expect(tabs).not.toContain('clinical')
  })

  it('patients.view alone: overview only', () => {
    expect(visiblePatientTabs(access({ 'patients.view': 'org' }))).toEqual([
      'overview',
    ])
  })
})

// The first render pulls in Radix + lucide: slow on a cold, busy machine.
describe('PatientDetailTabs', { timeout: 30_000 }, () => {
  it('renders the billing tab only with billing.invoice.view', () => {
    expect(renderTabs(access(RECEPTIONIST, ALL_FEATURES))).toContain('Billing')
  })

  it('hides billing and shows clinical tabs for a doctor', () => {
    const labels = renderTabs(access(DOCTOR, ALL_FEATURES))
    expect(labels).not.toContain('Billing')
    expect(labels).toEqual(
      expect.arrayContaining([
        'Visits',
        'Teeth Chart',
        'Clinical & Rx',
        'Files',
      ]),
    )
  })

  it('shows the messages card on overview only for patients.edit', () => {
    renderTabs(access(DOCTOR, ALL_FEATURES))
    expect(screen.queryByTestId('body-messages')).toBeNull()
  })
})
