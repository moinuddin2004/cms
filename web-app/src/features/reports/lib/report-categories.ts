import type { ComponentType } from 'react'
import {
  Banknote,
  CalendarCheck,
  FlaskConical,
  PieChart,
  Receipt,
  Stethoscope,
  Timer,
  UserCog,
  Users,
} from 'lucide-react'
import type { ReportCategory } from '../types/reports.types'

export const CATEGORY_META: Record<
  ReportCategory,
  { label: string; icon: ComponentType<{ className?: string }>; tone: string }
> = {
  finance: {
    label: 'Profit & cash',
    icon: PieChart,
    tone: 'bg-emerald-soft text-emerald',
  },
  revenue: {
    label: 'Revenue & collections',
    icon: Banknote,
    tone: 'bg-primary-soft text-primary-text',
  },
  expenses: {
    label: 'Expenses',
    icon: Receipt,
    tone: 'bg-amber-soft text-amber',
  },
  staff: {
    label: 'Staff & payroll',
    icon: UserCog,
    tone: 'bg-violet-soft text-violet',
  },
  lab: { label: 'Lab', icon: FlaskConical, tone: 'bg-danger-soft text-danger' },
  patients: {
    label: 'Patients',
    icon: Users,
    tone: 'bg-primary-soft text-primary-text',
  },
  appointments: {
    label: 'Appointments',
    icon: CalendarCheck,
    tone: 'bg-violet-soft text-violet',
  },
  operations: {
    label: 'Waiting & queue',
    icon: Timer,
    tone: 'bg-amber-soft text-amber',
  },
  clinical: {
    label: 'Clinical',
    icon: Stethoscope,
    tone: 'bg-emerald-soft text-emerald',
  },
}

export const CATEGORY_ORDER: ReportCategory[] = [
  'finance',
  'revenue',
  'expenses',
  'staff',
  'patients',
  'appointments',
  'operations',
  'clinical',
  'lab',
]
