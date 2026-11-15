import { LegalDocument } from '../components/LegalDocument'
import { LegalShell } from '../components/LegalShell'
import { LEGAL_CONTENT } from '../content/legal-content.generated'

export function TermsPage() {
  return (
    <LegalShell>
      <LegalDocument blocks={LEGAL_CONTENT.terms} />
    </LegalShell>
  )
}
