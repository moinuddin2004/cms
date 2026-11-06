import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useAuthStore } from '@/store/useAuthStore'
import { NotificationBell } from './components/NotificationBell'
import type { NotificationNewEvent } from './types'

// ── Mocks: API, router, toasts, socket, chime ────────────────────────────
const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}))
vi.mock('@/lib/api', () => ({ default: api, apiClient: api }))
const navigate = vi.hoisted(() => vi.fn())
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))
const toast = vi.hoisted(() =>
  Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
)
vi.mock('sonner', () => ({ toast }))

const socket = vi.hoisted(() => {
  const handlers = new Map<string, (arg?: unknown) => void>()
  return {
    handlers,
    on: vi.fn((event: string, fn: (arg?: unknown) => void) => {
      handlers.set(event, fn)
    }),
    removeAllListeners: vi.fn(),
    disconnect: vi.fn(),
    fire: (event: string, arg?: unknown) => handlers.get(event)?.(arg),
  }
})
const io = vi.hoisted(() => vi.fn(() => socket))
vi.mock('socket.io-client', () => ({ io }))

const chime = vi.hoisted(() => vi.fn())
vi.mock('./lib/notification-sound', () => ({
  playNotificationChime: chime,
  unlockNotificationSound: vi.fn(),
  readSoundPref: () => true,
  writeSoundPref: vi.fn(),
}))

const ok = <T,>(data: T) => ({ data: { success: true, data } })

function renderBell() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <NotificationBell />
    </QueryClientProvider>,
  )
}

const event = (
  over: Partial<NotificationNewEvent> = {},
): NotificationNewEvent => ({
  type: 'notification.new',
  id: 'n9',
  organizationId: 'org-a',
  eventCode: 'order.rejected',
  title: 'Order LAB-0009 rejected',
  body: 'Precision rejected order LAB-0009.',
  link: '/lab-orders/9',
  createdAt: new Date().toISOString(),
  ...over,
})

describe('NotificationBell realtime', () => {
  let unread = 0

  beforeEach(() => {
    vi.clearAllMocks()
    socket.handlers.clear()
    unread = 0
    useAuthStore.setState({
      accessToken: 'token',
      activeOrganizationId: 'org-a',
      accessibleOrganizations: [
        { id: 'org-a', name: 'Alpha Clinic' },
        { id: 'org-b', name: 'Beta Clinic' },
      ] as never,
    })
    api.get.mockImplementation((url: string) => {
      if (url === '/me/notifications/unread-count')
        return Promise.resolve(ok({ count: unread }))
      if (url === '/me/notifications/prefs')
        return Promise.resolve(ok({ sound: true, email: [] }))
      return Promise.resolve(
        ok({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
      )
    })
    api.put.mockResolvedValue(ok({ sound: false, email: [] }))
  })

  it('connects with the token and, on notification.new, refreshes the badge, toasts and chimes', async () => {
    renderBell()
    expect(io).toHaveBeenCalledWith(
      expect.stringContaining('/realtime'),
      expect.objectContaining({ auth: { token: 'token' } }),
    )

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(
        '/me/notifications/unread-count',
        expect.anything(),
      ),
    )
    const before = api.get.mock.calls.length
    unread = 1
    act(() => socket.fire('notification.new', event()))
    await waitFor(() =>
      expect(api.get.mock.calls.length).toBeGreaterThan(before),
    )

    expect((await screen.findByTestId('unread-badge')).textContent).toBe('1')
    expect(toast).toHaveBeenCalledWith(
      'Order LAB-0009 rejected',
      expect.objectContaining({
        description: 'Precision rejected order LAB-0009.',
        action: expect.objectContaining({ label: 'Open' }),
      }),
    )
    expect(chime).toHaveBeenCalledWith('n9')

    const opts = toast.mock.calls[0][1] as { action: { onClick: () => void } }
    opts.action.onClick()
    expect(navigate).toHaveBeenCalledWith({ to: '/lab-orders/9' })
  })

  it('a notification from another clinic names it and has no Open', async () => {
    renderBell()
    act(() =>
      socket.fire('notification.new', event({ organizationId: 'org-b' })),
    )
    await waitFor(() => expect(toast).toHaveBeenCalled())
    expect(toast).toHaveBeenCalledWith(
      'Order LAB-0009 rejected',
      expect.objectContaining({
        description: 'Beta Clinic · Precision rejected order LAB-0009.',
        action: undefined,
      }),
    )
  })

  it('does not connect when signed out', () => {
    useAuthStore.setState({ accessToken: null })
    renderBell()
    expect(io).not.toHaveBeenCalled()
  })

  it('the speaker button saves the sound switch', async () => {
    renderBell()
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }))
    fireEvent.click(
      await screen.findByRole('button', { name: /sound on — click to mute/i }),
    )
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/me/notifications/prefs', {
        sound: false,
      }),
    )
    expect(
      await screen.findByRole('button', {
        name: /sound off — click to unmute/i,
      }),
    ).toBeTruthy()
  })
})
