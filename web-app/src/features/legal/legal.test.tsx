import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LegalDocument } from './components/LegalDocument'
import { LEGAL_CONTENT } from './content/legal-content.generated'
import { DeleteAccountPage, PrivacyPage, TermsPage } from './index'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

describe('legal pages', () => {
  it('privacy page shows the draft banner, both spaces and placeholders', () => {
    render(<PrivacyPage />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Privacy Policy' }),
    ).toBeTruthy()
    expect(screen.getByRole('note').textContent).toMatch(/DRAFT/)
    expect(screen.getByText('Clinic staff')).toBeTruthy()
    expect(screen.getByText('Patients')).toBeTruthy()
    expect(document.body.textContent).toContain('[APP_NAME]')
  })

  it('terms page renders', () => {
    render(<TermsPage />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Terms of Use' }),
    ).toBeTruthy()
  })

  it('delete page explains in-app deletion and offers a mailto link', () => {
    render(<DeleteAccountPage />)
    expect(
      screen.getByText('Delete account', { selector: 'strong' }),
    ).toBeTruthy()
    const link = screen.getByRole('link', { name: 'Email a deletion request' })
    expect(link.getAttribute('href')).toMatch(
      /^mailto:.*subject=Delete%20my%20account/,
    )
  })

  it('content has no dental-only wording', () => {
    expect(JSON.stringify(LEGAL_CONTENT).toLowerCase()).not.toMatch(
      /dental|dentist|tooth|teeth/,
    )
  })

  it('renders lists and bold', () => {
    render(<LegalDocument blocks={[{ type: 'ul', items: ['a **b**'] }]} />)
    expect(screen.getByText('b').tagName).toBe('STRONG')
  })
})
