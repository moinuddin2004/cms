import { LegalDocument } from '../components/LegalDocument'
import { LegalShell } from '../components/LegalShell'
import { LEGAL_CONTENT } from '../content/legal-content.generated'

export function PrivacyPage() {
  return (
    <LegalShell>
      <LegalDocument blocks={LEGAL_CONTENT.privacy} />
    </LegalShell>
  )
}
