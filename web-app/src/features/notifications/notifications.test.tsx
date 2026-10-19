import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { NotificationBell } from './components/NotificationBell'
import { NotificationSettingsPage } from './pages/NotificationSettingsPage'
import { quietHoursSchema, templateSchema } from './schemas/notification.schema'
import type { MyNotification, NotificationOverview } from './types'

// ── Mocks: API transport, router, toasts, page chrome ────────────────────
const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}))
vi.mock('@/lib/api', () => ({ default: api, apiClient: api }))
const navigate = vi.hoisted(() => vi.fn())
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => navigate,
}))
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))
vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({
    title,
    children,
  }: {
    title?: string
    children: ReactNode
  }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}))

const overview: NotificationOverview = {
  audiences: [
    {
      audience: 'patient',
      isEnabled: false,
      quietStart: null,
      quietEnd: null,
      timezone: null,
      isDefault: true,
    },
    {
      audience: 'doctor',
      isEnabled: true,
      quietStart: null,
      quietEnd: null,
      timezone: null,
      isDefault: true,
    },
    {
      audience: 'coordinator',
      isEnabled: true,
      quietStart: null,
      quietEnd: null,
      timezone: null,
      isDefault: true,
    },
    {
      audience: 'lab',
      isEnabled: true,
      quietStart: '22:00',
      quietEnd: '08:00',
      timezone: null,
      isDefault: false,
    },
  ],
  events: [
    {
      code: 'payment.receipt',
      name: 'Payment receipt',
      description: 'A patient paid; send the receipt.',
      audiences: ['patient'],
      isMandatoryInternal: false,
      variables: ['clinic_name', 'recipient_name', 'receipt_no', 'amount'],
      rules: [
        {
          audience: 'patient',
          channel: 'whatsapp',
          isEnabled: false,
          isDefault: true,
          locked: false,
        },
        {
          audience: 'patient',
          channel: 'sms',
          isEnabled: false,
          isDefault: true,
          locked: false,
        },
      ],
    },
    {
      code: 'order.submitted',
      name: 'New lab order',
      description: 'A clinic sent a new order to the lab.',
      audiences: ['lab'],
      isMandatoryInternal: true,
      variables: ['clinic_name', 'recipient_name', 'order_no'],
      rules: [
        {
          audience: 'lab',
          channel: 'in_app',
          isEnabled: true,
          isDefault: true,
          locked: true,
        },
        {
          audience: 'lab',
          channel: 'whatsapp',
          isEnabled: false,
          isDefault: true,
          locked: false,
        },
        {
          audience: 'lab',
          channel: 'email',
          isEnabled: false,
          isDefault: true,
          locked: false,
        },
      ],
    },
  ],
  channelsByAudience: {
    patient: ['whatsapp', 'sms'],
    doctor: ['in_app', 'whatsapp', 'email'],
    coordinator: ['in_app', 'whatsapp', 'email'],
    lab: ['in_app', 'whatsapp', 'email'],
  },
  languages: ['en', 'ur', 'roman_ur'],
}

const ok = <T,>(data: T) => ({ data: { data } })

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('NotificationSettingsPage', () => {
  beforeEach(() => {
    api.get.mockImplementation((url: string) =>
      url === '/notification-settings'
        ? Promise.resolve(ok(overview))
        : Promise.resolve(
            ok({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
          ),
    )
    api.put.mockResolvedValue(ok({ changed: 1 }))
    api.patch.mockResolvedValue(ok({}))
  })

  it('shows patients OFF by default and saves a rule toggle', async () => {
    renderWithClient(<NotificationSettingsPage />)
    const master = await screen.findByRole('switch', {
      name: 'Notifications to patients',
    })
    expect(master.getAttribute('aria-checked')).toBe('false')

    const whatsapp = screen.getByRole('switch', {
      name: 'Payment receipt — WhatsApp to patients',
    })
    expect(whatsapp.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(whatsapp)
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/notification-settings/rules', {
        rules: [
          {
            eventCode: 'payment.receipt',
            audience: 'patient',
            channel: 'whatsapp',
            isEnabled: true,
          },
        ],
      }),
    )
  })

  it('switching the patient master on calls the audience API', async () => {
    renderWithClient(<NotificationSettingsPage />)
    fireEvent.click(
      await screen.findByRole('switch', { name: 'Notifications to patients' }),
    )
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith(
        '/notification-settings/audiences/patient',
        { isEnabled: true },
      ),
    )
  })

  it('mandatory in-app rules are locked on the team tab', async () => {
    renderWithClient(<NotificationSettingsPage />)
    const tab = await screen.findByRole('tab', { name: 'Team & labs' })
    fireEvent.mouseDown(tab, { button: 0, ctrlKey: false })
    const locked = await screen.findByRole('switch', {
      name: 'New lab order — In-app to labs',
    })
    expect(locked.getAttribute('aria-checked')).toBe('true')
    expect((locked as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Quiet hours 22:00 – 08:00')).toBeTruthy()
  })

  it('shows an error state with retry when settings fail to load', async () => {
    api.get.mockRejectedValue(new Error('down'))
    renderWithClient(<NotificationSettingsPage />)
    expect(await screen.findByText('Something went wrong')).toBeTruthy()
  })
})

describe('NotificationBell', () => {
  const item: MyNotification = {
    id: 'n1',
    organizationId: 'org',
    eventCode: 'order.accepted',
    title: 'Order LAB-0002 accepted',
    body: 'Precision accepted order LAB-0002.',
    link: '/labs',
    readAt: null,
    createdAt: new Date().toISOString(),
  }

  beforeEach(() => {
    api.get.mockImplementation((url: string) =>
      url === '/me/notifications/unread-count'
        ? Promise.resolve(ok({ count: 3 }))
        : Promise.resolve(
            ok({ data: [item], total: 1, page: 1, limit: 20, totalPages: 1 }),
          ),
    )
    api.post.mockResolvedValue(ok({ updated: 3 }))
  })

  it('shows the unread count, lists notifications and marks all read', async () => {
    renderWithClient(<NotificationBell />)
    expect((await screen.findByTestId('unread-badge')).textContent).toBe('3')
    fireEvent.click(
      screen.getByRole('button', { name: 'Notifications (3 unread)' }),
    )
    expect(await screen.findByText('Order LAB-0002 accepted')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /mark all read/i }))
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/me/notifications/read-all',
        undefined,
      ),
    )
  })

  it('opening an unread notification marks it read and follows its link', async () => {
    renderWithClient(<NotificationBell />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Notifications (3 unread)' }),
    )
    fireEvent.click(await screen.findByText('Order LAB-0002 accepted'))
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/me/notifications/n1/read',
        undefined,
      ),
    )
    expect(navigate).toHaveBeenCalledWith({ to: '/labs' })
  })
})

describe('notification schemas', () => {
  it('quiet hours need distinct HH:MM times when on', () => {
    expect(
      quietHoursSchema.safeParse({
        enabled: true,
        start: '22:00',
        end: '22:00',
        timezone: '',
      }).success,
    ).toBe(false)
    expect(
      quietHoursSchema.safeParse({
        enabled: true,
        start: '22:00',
        end: '08:00',
        timezone: '',
      }).success,
    ).toBe(true)
    expect(
      quietHoursSchema.safeParse({
        enabled: false,
        start: '',
        end: '',
        timezone: '',
      }).success,
    ).toBe(true)
  })

  it('templates may only use the event placeholders', () => {
    const schema = templateSchema(['clinic_name', 'amount'])
    expect(
      schema.safeParse({
        subject: '',
        body: 'Paid {amount} at {clinic_name}',
        providerTemplateRef: '',
      }).success,
    ).toBe(true)
    expect(
      schema.safeParse({
        subject: '',
        body: 'Hi {nickname}',
        providerTemplateRef: '',
      }).success,
    ).toBe(false)
    expect(
      schema.safeParse({ subject: '', body: '   ', providerTemplateRef: '' })
        .success,
    ).toBe(false)
  })
})
