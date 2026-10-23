import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { BrandMark } from '@/components/layout/BrandMark'
import { useAuthStore } from '@/store/useAuthStore'
import { useTheme } from '@/hooks/useTheme'
import { ThemeProvider } from './components/ThemeProvider'
import { useThemeStore } from './hooks/useThemeStore'
import { themeChanges, themeFormDefaults } from './hooks/useThemeForm'
import { buildThemeCss } from './lib/apply-theme'
import {
  checkBrandContrast,
  contrastRatio,
  deriveBrandPalette,
  hexToOklch,
  oklchToHex,
  readableForeground,
} from './lib/color'
import { DEFAULT_THEME } from './types'
import type { ClinicTheme, ThemeKeyView } from './types'

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn() }))
vi.mock('@/lib/api', () => ({ default: api, apiClient: api }))

const TEAL: ClinicTheme = {
  ...DEFAULT_THEME,
  app_name: 'Smile Dental',
  brand_color: '#0d9488',
  sidebar_style: 'brand',
  default_mode: 'dark',
  favicon_url: 'https://cdn.example.com/fav.png',
}

const rootVar = (name: string) =>
  document
    .getElementById('clinic-theme')
    ?.textContent.match(new RegExp(`:root \\{[^}]*${name}: ([^;]+);`))?.[1]

describe('colour utils', () => {
  it('round-trips hex through OKLCH', () => {
    for (const hex of ['#2563eb', '#0d9488', '#facc15', '#000000', '#ffffff']) {
      expect(oklchToHex(hexToOklch(hex))).toBe(hex)
    }
  })

  it('computes WCAG contrast', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5)
    expect(contrastRatio('#2563eb', '#ffffff')).toBeCloseTo(5.17, 1)
    expect(contrastRatio('#777777', '#777777')).toBe(1)
  })

  it('picks white or black text for the brand colour', () => {
    expect(readableForeground('#2563eb')).toBe('#ffffff')
    expect(readableForeground('#0f172a')).toBe('#ffffff')
    expect(readableForeground('#facc15')).toBe('#000000')
    expect(readableForeground('#a3e635')).toBe('#000000')
  })

  it('derives readable shades for light and dark mode', () => {
    for (const hex of ['#2563eb', '#facc15', '#0d9488', '#111827']) {
      const p = deriveBrandPalette(hex)
      expect(p.light.brand).toBe(hex)
      // Brand text stays readable on white and on the dark background.
      expect(contrastRatio(p.light.text, '#ffffff')).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(p.dark.text, '#0f172a')).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(p.light.brand, p.light.foreground)).toBeGreaterThan(
        contrastRatio(
          p.light.brand,
          p.light.foreground === '#ffffff' ? '#000000' : '#ffffff',
        ) - 1e-9,
      )
      expect(p.light.soft).toMatch(/^#[0-9a-f]{6}$/)
      expect(Object.keys(p.ramp)).toHaveLength(10)
    }
  })

  it('warns about colours that are too light', () => {
    expect(checkBrandContrast('#2563eb').warnings).toEqual([])
    const yellow = checkBrandContrast('#fde047')
    expect(yellow.warnings.join(' ')).toMatch(/very light/)
  })
})

/** The app root mounts useTheme(); it applies the clinic's default mode. */
function ModeHost() {
  useTheme()
  return null
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    api.get.mockReset()
    document.getElementById('clinic-theme')?.remove()
    delete document.documentElement.dataset.sidebarStyle
    document.head.innerHTML =
      '<link rel="icon" href="/favicon.svg" type="image/svg+xml">'
    window.localStorage.clear()
    useThemeStore.setState({ theme: DEFAULT_THEME, isLoading: false })
    useAuthStore.setState({
      isAuthenticated: true,
      activeOrganizationId: 'org-1',
      activeLocationId: 'loc-1',
    })
  })

  const mount = () =>
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <ModeHost />
        <ThemeProvider />
      </QueryClientProvider>,
    )

  it('applies brand variables, sidebar style, title, favicon and default mode', async () => {
    api.get.mockResolvedValue({ data: { data: TEAL } })
    mount()

    await waitFor(() => expect(rootVar('--brand')).toBe('#0d9488'))
    expect(api.get).toHaveBeenCalledWith('/theme')
    expect(rootVar('--brand-hover')).toMatch(/^#[0-9a-f]{6}$/)
    expect(rootVar('--brand-soft')).toMatch(/^#[0-9a-f]{6}$/)
    expect(rootVar('--brand-text')).toMatch(/^#[0-9a-f]{6}$/)
    // Teal: black text has 5.6:1 contrast, white only 3.7:1.
    expect(rootVar('--primary-foreground')).toBe('#000000')
    expect(document.getElementById('clinic-theme')?.textContent).toContain(
      '.dark {',
    )
    expect(document.documentElement.dataset.sidebarStyle).toBe('brand')
    expect(document.title).toBe('Smile Dental')
    expect(
      document.querySelector('link[rel="icon"]')?.getAttribute('href'),
    ).toBe('https://cdn.example.com/fav.png')
    expect(useThemeStore.getState().theme.app_name).toBe('Smile Dental')
    // No saved preference → the clinic default (dark) applies.
    await waitFor(() =>
      expect(document.documentElement.classList.contains('dark')).toBe(true),
    )
    expect(window.localStorage.getItem('medtrackr.lastOrgId')).toBe('org-1')
  })

  it('uses the public endpoint for the remembered org before sign-in', async () => {
    window.localStorage.setItem(
      'medtrackr.lastOrgId',
      '7c0f5a3e-1d2b-4c5e-8f90-123456789abc',
    )
    useAuthStore.setState({
      isAuthenticated: false,
      activeOrganizationId: null,
    })
    api.get.mockResolvedValue({
      data: { data: { ...TEAL, brand_color: '#7c3aed' } },
    })
    mount()

    await waitFor(() => expect(rootVar('--brand')).toBe('#7c3aed'))
    expect(api.get).toHaveBeenCalledWith(
      '/public/theme/7c0f5a3e-1d2b-4c5e-8f90-123456789abc',
      { params: undefined },
    )
  })

  it('keeps defaults for a malformed brand colour', async () => {
    api.get.mockResolvedValue({
      data: { data: { ...TEAL, brand_color: 'red' } },
    })
    mount()
    await waitFor(() => expect(rootVar('--brand')).toBe('#2563eb'))
  })
})

describe('BrandMark', () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: DEFAULT_THEME, isLoading: false })
  })

  it('falls back to the initial and name without a logo', () => {
    render(<BrandMark />)
    expect(screen.getByText('Clinic Portal')).toBeTruthy()
    expect(screen.getByText('C')).toBeTruthy()
    expect(document.querySelector('img')).toBeNull()
  })

  it('shows the clinic logo and name, and falls back when the image fails', () => {
    act(() =>
      useThemeStore.setState({
        theme: {
          ...DEFAULT_THEME,
          app_name: 'Smile Dental',
          logo_url: 'https://cdn.example.com/logo.png',
        },
      }),
    )
    render(<BrandMark />)
    const img = document.querySelector('img')!
    expect(img.getAttribute('src')).toBe('https://cdn.example.com/logo.png')
    expect(screen.getByText('Smile Dental')).toBeTruthy()

    fireEvent.error(img)
    expect(document.querySelector('img')).toBeNull()
    expect(screen.getByText('S')).toBeTruthy()
  })

  it('collapsed shows only the mark, labelled with the name', () => {
    render(<BrandMark collapsed />)
    expect(screen.queryByText('Clinic Portal')).toBeNull()
    expect(screen.getByRole('img', { name: 'Clinic Portal' })).toBeTruthy()
  })

  it('renders both logos for the CSS to pick, or the dark one when inverse', () => {
    const theme = {
      app_name: 'X',
      logo_url: 'https://cdn.example.com/l.png',
      logo_dark_url: 'https://cdn.example.com/d.png',
    }
    const { unmount } = render(<BrandMark theme={theme} />)
    expect(
      [...document.querySelectorAll('img')].map((i) => i.dataset.logo),
    ).toEqual(['light', 'dark'])
    unmount()
    render(<BrandMark theme={theme} tone="inverse" />)
    expect(document.querySelectorAll('img')).toHaveLength(1)
    expect(document.querySelector('img')?.getAttribute('src')).toBe(
      'https://cdn.example.com/d.png',
    )
  })
})

describe('theme form', () => {
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
      platform: { value: '#111111', locked: true },
      org: { value: null, locked: false },
      effective: '#111111',
      inherited: '#111111',
      lockedAbove: true,
    },
  ]

  it('sends only changed, writable values; empty clears', () => {
    const before = themeFormDefaults(view, 'org')
    expect(before.values.app_name).toBe('Smile')
    expect(before.values.sidebar_style).toBe('light')
    const after = {
      values: { ...before.values, app_name: '', brand_color: '#222222' },
      locks: { ...before.locks, app_name: true },
    }
    expect(themeChanges(before, after, new Set(['brand_color']))).toEqual({
      values: { app_name: null },
      locks: { app_name: true },
    })
  })

  it('scopes preview CSS to its own container', () => {
    const css = buildThemeCss('#0d9488', {
      light: "[data-theme-preview='p']",
      dark: ".dark [data-theme-preview='p']",
    })
    expect(css).not.toContain(':root')
    expect(css).toContain('--primary: var(--brand);')
  })
})
