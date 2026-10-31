import {
  BellRing,
  BookOpen,
  BookmarkPlus,
  Building2,
  ClipboardList,
  CreditCard,
  FlaskConical,
  HandCoins,
  KeyRound,
  MapPin,
  Monitor,
  Palette,
  PanelLeft,
  Shield,
  SunMoon,
  Tags,
  ToggleRight,
  User,
  UserCog,
} from 'lucide-react'
import type { ElementType } from 'react'
import type { PermissionRequirement } from '@/features/access'

export type SettingsGroupId =
  | 'account'
  | 'clinic'
  | 'team'
  | 'billing'
  | 'clinical'
  | 'lab'

export const SETTINGS_GROUPS: { id: SettingsGroupId; label: string }[] = [
  { id: 'account', label: 'Your account' },
  { id: 'clinic', label: 'Clinic' },
  { id: 'team', label: 'Team & access' },
  { id: 'billing', label: 'Billing' },
  { id: 'clinical', label: 'Clinical templates' },
  { id: 'lab', label: 'Lab' },
]

/** One settings page and what it takes to see it. */
export interface SettingsItemDef {
  key: string
  label: string
  /** One line under the label (overview cards, search). */
  description: string
  icon: ElementType
  href: string
  group: SettingsGroupId
  /** Mirrors the route's `staticData.can` — the route gate is the real check. */
  can?: PermissionRequirement
  feature?: string
  /** The clinic owner only (subscription, clinic profile). */
  ownerOnly?: boolean
  /** Other paths that belong to this item (library tabs). */
  also?: string[]
  /** Extra words the settings search should find it by. */
  keywords?: string[]
}

/**
 * Every page under /settings. One-time and occasional clinic setup lives
 * here, never in the sidebar. The rail, the overview and the search all read
 * this list.
 */
export const SETTINGS_ITEMS: SettingsItemDef[] = [
  {
    key: 'profile',
    label: 'Profile',
    description: 'Your name, email and role in this clinic.',
    icon: User,
    href: '/settings/profile',
    group: 'account',
    keywords: ['name', 'email', 'me'],
  },
  {
    key: 'appearance',
    label: 'Appearance',
    description: 'Light or dark mode on this device.',
    icon: SunMoon,
    href: '/settings/appearance',
    group: 'account',
    keywords: ['dark', 'light', 'mode', 'theme'],
  },
  {
    key: 'security',
    label: 'Password',
    description: 'Change the password you sign in with.',
    icon: Shield,
    href: '/settings/security',
    group: 'account',
    keywords: ['security', 'login'],
  },
  {
    key: 'sessions',
    label: 'Signed-in devices',
    description: 'Where you are signed in. Sign out devices you don’t use.',
    icon: Monitor,
    href: '/settings/sessions',
    group: 'account',
    keywords: ['sessions', 'sign out'],
  },
  {
    key: 'clinic-profile',
    label: 'Clinic profile',
    description: 'Name, contact details, clinic type, timezone and currency.',
    icon: Building2,
    href: '/settings/clinic',
    group: 'clinic',
    ownerOnly: true,
    keywords: ['phone', 'email', 'timezone', 'currency', 'specialty'],
  },
  {
    key: 'theme',
    label: 'Branding & theme',
    description: 'Logo, brand colour and the look of screens and printouts.',
    icon: Palette,
    href: '/settings/theme',
    group: 'clinic',
    can: 'admin.theme.manage',
    keywords: ['logo', 'colour', 'color', 'brand'],
  },
  {
    key: 'locations',
    label: 'Locations',
    description: 'Branches and their booking, queue and tax rules.',
    icon: MapPin,
    href: '/settings/locations',
    group: 'clinic',
    can: 'admin.locations.manage',
    keywords: ['branch', 'slot', 'booking', 'queue', 'tax'],
  },
  {
    key: 'notifications',
    label: 'Notifications',
    description: 'Who gets notified about what, and the message log.',
    icon: BellRing,
    href: '/settings/notifications',
    group: 'clinic',
    can: 'notifications.settings.manage',
    keywords: ['alerts', 'messages'],
  },
  {
    key: 'subscription',
    label: 'Plan & billing',
    description: 'Your subscription, usage and payments.',
    icon: CreditCard,
    href: '/settings/subscription',
    group: 'clinic',
    ownerOnly: true,
    keywords: ['subscription', 'plan', 'trial', 'payment'],
  },
  {
    key: 'users',
    label: 'Users',
    description: 'Who can sign in, and to which clinic and location.',
    icon: UserCog,
    href: '/settings/users',
    group: 'team',
    can: 'admin.users.manage',
    keywords: ['logins', 'staff', 'accounts', 'invite'],
  },
  {
    key: 'roles',
    label: 'Roles & permissions',
    description: 'What each role can see and do.',
    icon: KeyRound,
    href: '/settings/roles',
    group: 'team',
    can: 'admin.roles.manage',
    keywords: ['access', 'doctor', 'receptionist'],
  },
  {
    key: 'features',
    label: 'Features',
    description: 'Turn the features in your plan on or off.',
    icon: ToggleRight,
    href: '/settings/features',
    group: 'team',
    can: 'admin.features.manage',
    keywords: ['modules', 'enable', 'disable'],
  },
  {
    key: 'sidebar',
    label: 'Sidebar',
    description: 'Rename, hide and reorder the pages in the sidebar.',
    icon: PanelLeft,
    href: '/settings/sidebar',
    group: 'team',
    can: 'admin.nav.manage',
    keywords: ['menu', 'navigation'],
  },
  {
    key: 'billing',
    label: 'Services, prices & payments',
    description: 'Price list, discount types, payment accounts and printing.',
    icon: HandCoins,
    href: '/settings/billing',
    group: 'billing',
    can: 'admin.settings.manage',
    feature: 'billing.invoices',
    keywords: ['services', 'discounts', 'invoice', 'receipt', 'print'],
  },
  {
    key: 'plan-templates',
    label: 'Treatment plan templates',
    description: 'Ready-made treatment plans, e.g. root canal or implant.',
    icon: ClipboardList,
    href: '/settings/plan-templates',
    group: 'clinical',
    can: 'plans.templates.manage',
    keywords: ['treatment', 'plans'],
  },
  {
    key: 'prescription-library',
    label: 'Prescription library',
    description: 'Medicine sets, the medicine directory and print layouts.',
    icon: BookOpen,
    href: '/settings/prescription-presets',
    group: 'clinical',
    can: ['prescriptions.create', 'prescriptions.library.manage'],
    also: ['/settings/medicine-directory', '/settings/prescription-templates'],
    keywords: ['presets', 'medicines', 'drugs', 'letterhead', 'print'],
  },
  {
    key: 'labs',
    label: 'Connected labs',
    description: 'The dental labs your clinic sends work to.',
    icon: FlaskConical,
    href: '/settings/labs',
    group: 'lab',
    can: 'lab.links.manage',
  },
  {
    key: 'lab-catalog',
    label: 'Lab price list',
    description: 'Lab costs, patient prices and which lab makes what.',
    icon: Tags,
    href: '/settings/lab-catalog',
    group: 'lab',
    can: 'lab.catalog.manage',
    keywords: ['prices', 'mapping'],
  },
  {
    key: 'lab-order-templates',
    label: 'Lab order templates',
    description: 'Your usual lab orders, ready to send in seconds.',
    icon: BookmarkPlus,
    href: '/settings/lab-order-templates',
    group: 'lab',
    can: 'lab.orders.create',
  },
]

export interface SettingsViewer {
  can: (perm?: PermissionRequirement | null) => boolean
  hasFeature: (key: string) => boolean
  isOwner: boolean
}

export function canSeeSettingsItem(
  item: SettingsItemDef,
  viewer: SettingsViewer,
): boolean {
  if (item.ownerOnly && !viewer.isOwner) return false
  if (item.feature && !viewer.hasFeature(item.feature)) return false
  return viewer.can(item.can)
}

export function matchesSettingsSearch(item: SettingsItemDef, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [item.label, item.description, ...(item.keywords ?? [])].some((s) =>
    s.toLowerCase().includes(q),
  )
}

/** Whether `pathname` is this item's page (or one of its sub-pages). */
export function isSettingsItemActive(item: SettingsItemDef, pathname: string) {
  return [item.href, ...(item.also ?? [])].some(
    (href) => pathname === href || pathname.startsWith(href + '/'),
  )
}
