import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PatientMessagesCard } from './components/PatientMessagesCard'

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }))
vi.mock('@/lib/api', () => ({ default: api, apiClient: api }))
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

const prefs = {
  patientId: 'p1',
  whatsappOptOut: false,
  smsOptOut: true,
  emailOptOut: false,
  preferredLanguage: null,
  optedOutAt: null,
}

describe('PatientMessagesCard (§16 patient opt-out)', () => {
  it('shows each channel and saves an opt-out', async () => {
    api.get.mockResolvedValue({ data: { data: prefs } })
    api.put.mockResolvedValue({
      data: { data: { ...prefs, whatsappOptOut: true } },
    })
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <PatientMessagesCard patientId="p1" />
      </QueryClientProvider>,
    )
    const whatsapp = await screen.findByRole('switch', {
      name: 'WhatsApp messages',
    })
    await waitFor(() =>
      expect(whatsapp.getAttribute('aria-checked')).toBe('true'),
    )
    expect(
      screen
        .getByRole('switch', { name: 'SMS messages' })
        .getAttribute('aria-checked'),
    ).toBe('false')

    fireEvent.click(whatsapp)
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith(
        '/notification-settings/patients/p1/prefs',
        { whatsappOptOut: true },
      ),
    )
  })
})
