import type { SignInBlockCode } from '@/store/useAuthStore'

/** Short label for a clinic the session can't open (selector badge). */
export function clinicBlockLabel(code: SignInBlockCode): string {
  switch (code) {
    case 'CLINIC_PENDING_APPROVAL':
      return 'Awaiting approval'
    case 'CLINIC_REJECTED':
      return 'Not approved'
    case 'GOOGLE_SIGN_IN_REQUIRED':
      return 'Google sign-in required'
    case 'GOOGLE_SIGN_IN_DISABLED':
      return 'Password sign-in required'
    case 'GOOGLE_DOMAIN_NOT_ALLOWED':
      return 'Use your work Google account'
  }
}
