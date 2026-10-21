import {
  Activity,
  BarChart3,
  Banknote,
  BookmarkPlus,
  Building2,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileBarChart,
  FileJson,
  FileText,
  FlaskConical,
  Folder,
  GitBranch,
  HandCoins,
  History,
  Layers,
  LayoutDashboard,
  MapPin,
  PieChart,
  Receipt,
  Settings,
  Shield,
  SlidersHorizontal,
  Stethoscope,
  Tags,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react'
import type { ElementType } from 'react'
import type { PermissionRequirement } from '../types/access.types'

/** A page the sidebar can link to, and what it takes to see it. */
export interface NavItemDef {
  label: string
  icon: ElementType
  href: string
  /** Permission(s) to see the item — any-of when an array. */
  can?: PermissionRequirement
  superAdminOnly?: boolean
  ownerOrSuperAdmin?: boolean
  /** Lab-side entry: shown to users with at least one lab membership. */
  labMember?: boolean
}

/**
 * Every page that can appear in the sidebar. Developer-owned: the layout
 * (clinic-owned data) only arranges these keys, it never grants access.
 */
export const NAV_ITEMS = {
  'nav.dashboard': {
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: '/dashboard',
  },
  'nav.clinic_overview': {
    label: 'Clinic overview',
    icon: Activity,
    href: '/clinic-overview',
    can: 'reports.clinical.view',
  },
  'nav.patients': {
    label: 'Patients',
    icon: Users,
    href: '/patients',
    can: 'patients.view',
  },
  'nav.appointments': {
    label: 'Appointments',
    icon: CalendarDays,
    href: '/appointments',
    can: 'appointments.view',
  },
  'nav.queue.doctor': {
    label: 'My Queue',
    icon: Stethoscope,
    href: '/queue/doctor',
    can: 'queue.doctor.own',
  },
  'nav.my_earnings': {
    label: 'My earnings',
    icon: Wallet,
    href: '/my-earnings',
    can: 'earnings.own.view',
  },
  'nav.prescriptions': {
    label: 'Prescriptions',
    icon: FileText,
    href: '/prescriptions',
    can: 'prescriptions.create',
  },
  'nav.plan_templates': {
    label: 'Treatment Plans',
    icon: ClipboardList,
    href: '/plan-templates',
    can: 'plans.templates.manage',
  },
  'nav.labs': {
    label: 'Labs',
    icon: FlaskConical,
    href: '/labs',
    can: 'lab.links.manage',
  },
  'nav.lab_portal': {
    label: 'Lab portal',
    icon: FlaskConical,
    href: '/lab-portal',
    labMember: true,
  },
  'nav.lab.orders': {
    label: 'Lab orders',
    icon: FlaskConical,
    href: '/lab-orders',
    can: 'lab.orders.view',
  },
  'nav.lab.billing': {
    label: 'Lab billing',
    icon: Receipt,
    href: '/lab-billing',
    can: 'lab.billing.manage',
  },
  'nav.lab.catalog': {
    label: 'Lab price list',
    icon: Tags,
    href: '/lab-catalog',
    can: 'lab.catalog.manage',
  },
  'nav.lab.templates': {
    label: 'Order templates',
    icon: BookmarkPlus,
    href: '/lab-order-templates',
    can: 'lab.orders.create',
  },
  'nav.lab.payables': {
    label: 'Lab payables',
    icon: Wallet,
    href: '/lab-payables',
    can: 'lab.payables.manage',
  },
  'nav.finance': {
    label: 'Finance overview',
    icon: PieChart,
    href: '/finance',
    can: 'finance.overview.view',
  },
  'nav.billing.desk': {
    label: 'Billing desk',
    icon: HandCoins,
    href: '/billing',
    can: 'billing.desk.use',
  },
  'nav.invoices': {
    label: 'Invoices',
    icon: Receipt,
    href: '/invoices',
    can: 'billing.invoice.view',
  },
  'nav.payments': {
    label: 'Payments',
    icon: Banknote,
    href: '/payments',
    can: 'billing.payment.collect',
  },
  'nav.expenses': {
    label: 'Expenses',
    icon: Wallet,
    href: '/expenses',
    can: 'expenses.view',
  },
  'nav.reports': {
    label: 'All reports',
    icon: FileBarChart,
    href: '/reports',
    can: ['reports.financial.view', 'reports.clinical.view'],
  },
  'nav.reports.doctor_revenue': {
    label: 'Doctor revenue',
    icon: BarChart3,
    href: '/billing/doctor-revenue',
    can: 'reports.financial.view',
  },
  'nav.reports.doctor_earnings': {
    label: 'Doctor earnings',
    icon: Wallet,
    href: '/billing/doctor-earnings',
    can: 'earnings.all.view',
  },
  'nav.billing.activity': {
    label: 'Billing activity',
    icon: History,
    href: '/billing/activity',
    can: 'billing.activity.view',
  },
  'nav.employees': {
    label: 'Employees',
    icon: UserCog,
    href: '/employees',
    can: 'employees.view',
  },
  'nav.payroll': {
    label: 'Payroll',
    icon: CreditCard,
    href: '/payroll',
    can: 'payroll.manage',
  },
  'nav.organizations': {
    label: 'Organizations',
    icon: Building2,
    href: '/organizations',
    superAdminOnly: true,
  },
  'nav.lab_directory': {
    label: 'Lab Directory',
    icon: FlaskConical,
    href: '/lab-directory',
    superAdminOnly: true,
  },
  'nav.studio.forms': {
    label: 'Form schemas',
    icon: FileJson,
    href: '/studio/forms',
    superAdminOnly: true,
  },
  'nav.studio.workflows': {
    label: 'Workflows',
    icon: GitBranch,
    href: '/studio/workflows',
    superAdminOnly: true,
  },
  'nav.studio.stages': {
    label: 'Stage templates',
    icon: Layers,
    href: '/studio/stages',
    superAdminOnly: true,
  },
  'nav.locations': {
    label: 'Locations',
    icon: MapPin,
    href: '/locations',
    can: 'admin.locations.manage',
  },
  'nav.users': {
    label: 'User Admin',
    icon: Shield,
    href: '/users',
    can: 'admin.users.manage',
  },
  'nav.settings': {
    label: 'Settings',
    icon: Settings,
    href: '/settings',
  },
} satisfies Record<string, NavItemDef>

export type NavKey = keyof typeof NAV_ITEMS

/** Keys the sidebar renders outside the layout (pinned in the footer). */
export const FOOTER_NAV_KEYS: readonly NavKey[] = ['nav.settings']

/** Icons a layout may name for its groups (layout JSON stores names). */
export const NAV_ICONS: Record<string, ElementType> = {
  BarChart3,
  Banknote,
  Building2,
  FlaskConical,
  Folder,
  HandCoins,
  Layers,
  PieChart,
  Receipt,
  Settings,
  Shield,
  SlidersHorizontal,
  Stethoscope,
  UserCog,
  Users,
  Wallet,
}

export interface NavLayoutItem {
  key: string
  /** Clinic rename, e.g. "Billing desk" → "Cash counter". */
  label?: string
  pinned?: boolean
}

/** A collapsible group of links. */
export interface NavLayoutGroup {
  label: string
  group: true
  /** Name from NAV_ICONS. */
  icon?: string
  items: NavLayoutItem[]
}

/**
 * A titled block of the sidebar. `group: true` turns the whole section into
 * one collapsible group (as in the design doc); groups may also sit inside a
 * section's items, which is how today's Finance → Billing / Reports nest.
 */
export interface NavLayoutSection {
  label?: string
  group?: boolean
  icon?: string
  items: (NavLayoutItem | NavLayoutGroup)[]
}

/** Shape of `nav_layouts.layout`. */
export interface NavLayout {
  sections: NavLayoutSection[]
  /** Keys the clinic chose to hide. */
  hidden?: string[]
  homeRoute?: string
}

/** Code default — reproduces the pre-customization sidebar exactly. */
export const DEFAULT_NAV_LAYOUT: NavLayout = {
  sections: [
    { items: [{ key: 'nav.dashboard' }] },
    {
      label: 'Clinic',
      items: [
        { key: 'nav.clinic_overview' },
        { key: 'nav.patients' },
        { key: 'nav.appointments' },
        { key: 'nav.queue.doctor' },
        { key: 'nav.my_earnings' },
        { key: 'nav.prescriptions' },
        { key: 'nav.plan_templates' },
        { key: 'nav.labs' },
        { key: 'nav.lab_portal' },
        { key: 'nav.lab.orders' },
        { key: 'nav.lab.billing' },
        { key: 'nav.lab.catalog' },
        { key: 'nav.lab.templates' },
        { key: 'nav.lab.payables' },
      ],
    },
    {
      label: 'Finance',
      items: [
        { key: 'nav.finance' },
        {
          label: 'Billing',
          group: true,
          icon: 'HandCoins',
          items: [
            { key: 'nav.billing.desk' },
            { key: 'nav.invoices' },
            { key: 'nav.payments' },
            { key: 'nav.expenses' },
          ],
        },
        {
          label: 'Reports',
          group: true,
          icon: 'BarChart3',
          items: [
            { key: 'nav.reports' },
            { key: 'nav.reports.doctor_revenue' },
            { key: 'nav.reports.doctor_earnings' },
            { key: 'nav.billing.activity' },
          ],
        },
      ],
    },
    {
      label: 'Team',
      items: [{ key: 'nav.employees' }, { key: 'nav.payroll' }],
    },
    {
      label: 'Admin',
      items: [
        { key: 'nav.organizations' },
        { key: 'nav.lab_directory' },
        {
          label: 'Config Studio',
          group: true,
          icon: 'SlidersHorizontal',
          items: [
            { key: 'nav.studio.forms' },
            { key: 'nav.studio.workflows' },
            { key: 'nav.studio.stages' },
          ],
        },
        { key: 'nav.locations' },
        { key: 'nav.users' },
      ],
    },
  ],
  hidden: [],
}
