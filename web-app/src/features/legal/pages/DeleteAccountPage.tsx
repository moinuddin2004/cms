import { Button } from '@/components/ui/button'
import { LegalDocument } from '../components/LegalDocument'
import { LegalShell } from '../components/LegalShell'
import { LEGAL_CONTENT } from '../content/legal-content.generated'
import { DELETION_CONTACT } from '../content/contact'

/**
 * Public account-deletion page (Google Play requirement). No backend endpoint
 * exists for deletion requests from the web, so the fallback is an email link.
 */
export function DeleteAccountPage() {
  const subject = encodeURIComponent('Delete my account')
  return (
    <LegalShell>
      <LegalDocument blocks={LEGAL_CONTENT.deletion} />
      <div className="mt-6">
        <Button asChild>
          <a href={`mailto:${DELETION_CONTACT}?subject=${subject}`}>
            Email a deletion request
          </a>
        </Button>
      </div>
    </LegalShell>
  )
}
