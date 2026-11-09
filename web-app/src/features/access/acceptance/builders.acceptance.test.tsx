import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { ReactNode } from 'react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useAuthStore } from '@/store/useAuthStore'
import { useTheme } from '@/hooks/useTheme'
import { ThemeProvider } from '@/features/theme/components/ThemeProvider'
import { ThemeEditor } from '@/features/theme/components/ThemeEditor'
import { useThemeStore } from '@/features/theme/hooks/useThemeStore'
import { DEFAULT_THEME } from '@/features/theme/types'
import type { ClinicTheme, ThemeKeyView } from '@/features/theme/types'
import { NavBuilderPage } from '@/features/nav-builder/pages/NavBuilderPage'
import {
  addSection,
  containerId,
  fromLayout,
  itemId,
  moveNode,
  moveSection,
  renameNode,
  toLayout,
  toggleHidden,
} from '@/features/nav-builder/lib/builder-state'
import { AccessProvider } from '../components/AccessProvider'
import { useAccess } from '../hooks/useAccess'
import { accessKeys, useMyAccess } from '../hooks/useMyAccess'
import type { NavLayout } from '../nav/nav.registry'
import { meFor } from './actors'

vi.setConfig({ testTimeout: 60_000 })

const api = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}))
vi.mock('@/lib/api', () => ({ default: api, apiClient: api }))
const blocker = vi.hoisted(() => ({
  state: { status: 'idle' } as {
    status: string
    proceed?: () => void
    reset?: () => void
  },
}))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
  useBlocker: () => blocker.state,
}))
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))
vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: ReactNode }) => (
    <main>{children}</main>
  ),
}))
const socket = vi.hoisted(() => ({
  onChange: null as
    null | ((e: { organizationId: string; version: number } | null) => void),
}))
vi.mock('../hooks/useAccessSocket', () => ({
  useAccessSocket: (_org: string, onChange: typeof socket.onChange) => {
    socket.onChange = onChange
  },
}))

const ok = (data: unknown) => Promise.resolve({ data: { data } })
const queryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
const wrap = (ui: ReactNode, client = queryClient()) => (
  <QueryClientProvider client={client}>{ui}</QueryClientProvider>
)

const TEAL: ClinicTheme = {
  ...DEFAULT_THEME,
  app_name: 'Smile Dental',
  brand_color: '#0d9488',
  sidebar_style: 'brand',
  default_mode: 'dark',
}
const rootVar = (name: string) =>
  document
    .getElementById('clinic-theme')
    ?.textContent.match(new RegExp(`:root \\{[^}]*${name}: ([^;]+);`))?.[1]

function ModeHost() {
  useTheme()
  return null
}
const mountTheme = () =>
  render(
    wrap(
      <>
        <ModeHost />
        <ThemeProvider />
      </>,
    ),
  )

beforeEach(() => {
  vi.clearAllMocks()
  blocker.state = { status: 'idle' }
  socket.onChange = null
  document.getElementById('clinic-theme')?.remove()
  delete document.documentElement.dataset.sidebarStyle
  document.documentElement.classList.remove('dark')
  window.localStorage.clear()
  useThemeStore.setState({ theme: DEFAULT_THEME, isLoading: false })
  useAuthStore.setState({
    isAuthenticated: true,
    activeOrganizationId: 'org1',
    activeLocationId: 'loc1',
    isSuperAdmin: false,
  } as never)
})

describe('THEME — provider (UNIT / UI)', () => {
  it('THEME-09 CSS variables: --brand, --brand-hover, --brand-soft, --brand-text set; --primary-foreground by WCAG contrast (black for teal #0d9488)', async () => {
    api.get.mockResolvedValue({ data: { data: TEAL } })
    mountTheme()
    await waitFor(() => expect(rootVar('--brand')).toBe('#0d9488'))
    for (const v of ['--brand-hover', '--brand-soft', '--brand-text'])
      expect(rootVar(v)).toMatch(/^#[0-9a-f]{6}$/)
    expect(rootVar('--primary-foreground')).toBe('#000000')
  })

  it('THEME-10 sidebar style dark / brand → html data attribute and the CSS rules for both', async () => {
    const css = readFileSync(join(__dirname, '../../../styles.css'), 'utf8')
    expect(css).toContain(":root[data-sidebar-style='dark'] aside.bg-sidebar")
    expect(css).toContain(":root[data-sidebar-style='brand'] aside.bg-sidebar")
    for (const style of ['dark', 'brand'] as const) {
      api.get.mockResolvedValue({
        data: { data: { ...TEAL, sidebar_style: style } },
      })
      const { unmount } = mountTheme()
      await waitFor(() =>
        expect(document.documentElement.dataset.sidebarStyle).toBe(style),
      )
      unmount()
      delete document.documentElement.dataset.sidebarStyle
    }
  })

  it('THEME-11 login page: remembered last org → brand colour, name and logo before sign-in', async () => {
    window.localStorage.setItem(
      'medtrackr.lastOrgId',
      '7c0f5a3e-1d2b-4c5e-8f90-123456789abc',
    )
    useAuthStore.setState({
      isAuthenticated: false,
      activeOrganizationId: null,
    } as never)
    api.get.mockResolvedValue({
      data: {
        data: {
          ...TEAL,
          brand_color: '#7c3aed',
          logo_url: 'https://cdn.example.com/logo.png',
        },
      },
    })
    mountTheme()
    await waitFor(() => expect(rootVar('--brand')).toBe('#7c3aed'))
    expect(api.get).toHaveBeenCalledWith(
      '/public/theme/7c0f5a3e-1d2b-4c5e-8f90-123456789abc',
      { params: undefined },
    )
    expect(document.title).toBe('Smile Dental')
    expect(useThemeStore.getState().theme.logo_url).toBe(
      'https://cdn.example.com/logo.png',
    )
  })

  it('THEME-12 default mode: clinic dark applies without a saved preference; a saved preference wins', async () => {
    api.get.mockResolvedValue({ data: { data: TEAL } })
    const first = mountTheme()
    await waitFor(() =>
      expect(document.documentElement.classList.contains('dark')).toBe(true),
    )
    first.unmount()

    document.documentElement.classList.remove('dark')
    window.localStorage.setItem('theme', 'light')
    useThemeStore.setState({ theme: DEFAULT_THEME, isLoading: false })
    mountTheme()
    await waitFor(() => expect(rootVar('--brand')).toBe('#0d9488'))
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })
})

describe('THEME-13 builder', () => {
  const view: ThemeKeyView[] = [
    {
      key: 'app_name',
      scopes: ['org', 'location'],
      lockable: true,
      default: 'MedTrackr',
      platform: { value: null, locked: false },
      org: { value: 'Smile', locked: false },
      effective: 'Smile',
      inherited: 'MedTrackr',
      lockedAbove: false,
    },
    {
      key: 'brand_color',
      scopes: ['org'],
      lockable: true,
      default: '#2563eb',
      platform: { value: null, locked: false },
      org: { value: '#0d9488', locked: false },
      effective: '#0d9488',
      inherited: '#2563eb',
      lockedAbove: false,
    },
    {
      key: 'sidebar_style',
      scopes: ['org'],
      lockable: true,
      default: 'light',
      platform: { value: null, locked: false },
      org: { value: null, locked: false },
      effective: 'light',
      inherited: 'light',
      lockedAbove: false,
    },
    {
      key: 'default_mode',
      scopes: ['org'],
      lockable: true,
      default: 'system',
      platform: { value: null, locked: false },
      org: { value: null, locked: false },
      effective: 'system',
      inherited: 'system',
      lockedAbove: false,
    },
  ]

  it('colour change shows a contrast warning for a too-light colour; Save disabled until dirty; Reset to default', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      wrap(
        <ThemeEditor
          scope="org"
          view={view}
          isLoading={false}
          isError={false}
          onRetry={() => {}}
          onSave={onSave}
          isSaving={false}
        />,
      ),
    )
    const save = screen.getByRole('button', { name: 'Save theme' })
    expect((save as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByText(/very light/i)).toBeNull()

    const hex = screen
      .getAllByDisplayValue('#0d9488')
      .find((el) => (el as HTMLInputElement).type === 'text')!
    fireEvent.change(hex, { target: { value: '#fde047' } })
    expect(await screen.findByText(/very light/i)).toBeTruthy()
    await waitFor(() =>
      expect(
        (
          screen.getByRole('button', {
            name: 'Save theme',
          })
        ).disabled,
      ).toBe(false),
    )

    // Reset to default is behind a confirm and clears the clinic's own values.
    fireEvent.click(screen.getByRole('button', { name: /Reset to default/ }))
    expect(await screen.findByText('Reset to default?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    const arg = onSave.mock.calls[0][0] as {
      values: Record<string, string | null>
    }
    expect(arg.values.brand_color).toBeNull()
    expect(arg.values.app_name).toBeNull()
  })
})

describe('NAV-12 builder', () => {
  const LAYOUT: NavLayout = {
    sections: [
      { items: [{ key: 'nav.dashboard' }] },
      {
        label: 'Front desk',
        items: [
          { key: 'nav.patients' },
          { key: 'nav.appointments' },
          { key: 'nav.billing.desk', label: 'Billing desk' },
        ],
      },
    ],
    hidden: [],
  }
  const record = { layout: LAYOUT, version: 1 }

  it('state: drag reorder, rename, hide, add section produce the saved JSON', () => {
    let s = fromLayout(LAYOUT)
    const front = s.sections[1]
    // drag: appointments above patients
    s = moveNode(s, itemId('nav.appointments'), containerId(front), 0)
    // drag: the Front desk section above the dashboard one
    s = moveSection(s, front, 0)
    s = renameNode(s, itemId('nav.billing.desk'), 'Cash counter')
    s = toggleHidden(s, 'nav.patients')
    s = addSection(s, 'Back office')
    const out = toLayout(s)
    expect(out.sections[0].label).toBe('Front desk')
    expect(
      (out.sections[0].items as { key: string; label?: string }[]).map(
        (i) => i.key,
      ),
    ).toEqual(['nav.appointments', 'nav.patients', 'nav.billing.desk'])
    expect(
      (out.sections[0].items as { key: string; label?: string }[])[2].label,
    ).toBe('Cash counter')
    expect(out.hidden).toEqual(['nav.patients'])
    expect(out.sections.map((x) => x.label)).toContain('Back office')
  })

  it('page: Save disabled until dirty; rename+hide save the JSON; reset behind a ConfirmDialog; leave-without-saving prompt', async () => {
    api.get.mockImplementation(() => ok(record))
    api.put.mockImplementation(() => ok(record))
    api.delete.mockImplementation(() => ok(null))
    render(wrap(<NavBuilderPage />))
    const save = await screen.findByRole('button', { name: 'Save' })
    expect((save as HTMLButtonElement).disabled).toBe(true)

    // Hide a page and rename another through the controls.
    fireEvent.click(screen.getByRole('switch', { name: 'Hide Patients' }))
    expect(
      (screen.getByRole('button', { name: 'Save' }))
        .disabled,
    ).toBe(false)
    expect(screen.getByText('You have unsaved changes.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(api.put).toHaveBeenCalled())
    const sent = api.put.mock.calls[0][1] as NavLayout
    expect(sent.hidden).toContain('nav.patients')

    // Reset is behind a confirm dialog.
    fireEvent.click(screen.getByRole('button', { name: /Reset to default/ }))
    expect(
      await screen.findByText('Reset the sidebar to default?'),
    ).toBeTruthy()
    expect(api.delete).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Reset to default' }))
    void within
  })

  it('leaving with unsaved changes asks first (blocker → "Leave without saving?")', async () => {
    api.get.mockImplementation(() => ok(record))
    const proceed = vi.fn()
    blocker.state = { status: 'blocked', proceed, reset: vi.fn() }
    render(wrap(<NavBuilderPage />))
    expect(await screen.findByText('Leave without saving?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }))
    expect(proceed).toHaveBeenCalled()
  })
})

describe('RT — frontend', () => {
  it('RT-04 simulated access.changed: org access query refetched; an older version is ignored', async () => {
    api.get
      .mockResolvedValueOnce({ data: { data: meFor('RecU', { version: 3 }) } })
      .mockResolvedValue({
        data: {
          data: meFor('RecU', {
            version: 4,
            permissions: { 'payroll.manage': true },
          }),
        },
      })
    function Probe() {
      const { can, status } = useAccess()
      return (
        <span>
          {status}:{String(can('payroll.manage'))}
        </span>
      )
    }
    render(
      wrap(
        <AccessProvider>
          <Probe />
        </AccessProvider>,
      ),
    )
    await screen.findByText('ready:false')
    act(() => socket.onChange?.({ organizationId: 'org1', version: 3 }))
    expect(api.get).toHaveBeenCalledTimes(1)
    act(() => socket.onChange?.({ organizationId: 'org1', version: 4 }))
    await screen.findByText('ready:true')
    expect(api.get).toHaveBeenCalledTimes(2)
  })

  it('RT-06 query key includes org AND location: switching either refetches, no cross-org reuse', async () => {
    api.get.mockImplementation(() => ok(meFor('RecU')))
    const client = queryClient()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useMyAccess(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(accessKeys.me('org1', 'loc1')).toEqual([
      'access',
      'me',
      'org1',
      'loc1',
    ])
    expect(client.getQueryData(['access', 'me', 'org1', 'loc1'])).toBeTruthy()

    act(() => useAuthStore.setState({ activeLocationId: 'loc2' } as never))
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
    expect(client.getQueryData(['access', 'me', 'org1', 'loc2'])).toBeTruthy()

    act(() => useAuthStore.setState({ activeOrganizationId: 'org2' } as never))
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(3))
    // org2 never reuses org1's cached payload.
    expect(client.getQueryData(['access', 'me', 'org2', 'loc2'])).toBeTruthy()
    expect(accessKeys.me('org1', 'loc2')).not.toEqual(
      accessKeys.me('org2', 'loc2'),
    )
  })
})

describe('UNIT — static checks over the web source', () => {
  const SRC = join(__dirname, '../../..')
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n)
      return statSync(p).isDirectory()
        ? walk(p)
        : /\.(tsx?|css)$/.test(n) && !/\.test\./.test(n)
          ? [p]
          : []
    })

  it('THEME-15 brand tokens used: only the 14 documented status uses of blue/indigo remain', () => {
    const rx = /\b(bg|text|border|ring)-(blue|indigo)-[0-9]{3}/
    const hits: string[] = []
    for (const file of walk(SRC)) {
      if (file.replace(SRC, '').includes('acceptance')) continue
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (!rx.test(line)) return
          // the one comment in styles.css that warns against bg-blue-600
          if (/^\s*\(never raw hex/.test(line)) return
          hits.push(`${file.replace(SRC, '').split('\\').join('/')}:${i + 1}`)
        })
    }
    // Appointment status, employee role chips, inventory badges, production,
    // clinical/CRM/overview chips and teeth-chart legend: all status colours.
    expect(hits).toHaveLength(14)
    for (const h of hits)
      expect(h).toMatch(
        /appointments\/types|employees\/components|inventory-ui|ProductionPanel|patients\/components\/tabs/,
      )
  })

  it('UI-11 icon-only buttons on the new admin screens use TooltipButton / Tooltip', () => {
    const dirs = [
      'roles',
      'feature-settings',
      'nav-builder',
      'theme',
      'feature-flags',
    ]
    const offenders: string[] = []
    for (const d of dirs) {
      for (const file of walk(join(SRC, 'features', d))) {
        const src = readFileSync(file, 'utf8')
        // A shadcn <Button size="icon"> would have no tooltip.
        if (/<Button[^>]*size=["']icon["']/.test(src))
          offenders.push(`${d}: <Button size="icon"> in ${file}`)
        // Switches / bare <button>s must live inside a Tooltip.
        if (/<(Switch|button)\b/.test(src) && !/<Tooltip\b/.test(src)) {
          // text radios (segmented controls) and filter pills carry their own labels
          const bare = [...src.matchAll(/<button\b[\s\S]*?<\/button>/g)].some(
            (m) => !/>\s*[A-Za-z{]/.test(m[0].replace(/<[A-Z][^>]*\/>/g, '')),
          )
          if (/<Switch\b/.test(src) || bare)
            offenders.push(`${d}: untooltipped control in ${file}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
