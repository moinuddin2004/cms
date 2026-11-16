/** Claim / visit tokens are 32 random bytes, base64url (43 chars). */
export const isTokenShape = (token: string) => /^[A-Za-z0-9_-]{43}$/.test(token)

const scheme =
  (import.meta.env.VITE_APP_SCHEME as string | undefined) || 'clinicapp'

/** The only place a claim token leaves this page: the app's deep link. */
export const claimDeepLink = (token: string) => `${scheme}://claim/${token}`

export const PLAY_STORE_URL =
  (import.meta.env.VITE_PLAY_STORE_URL as string | undefined) || ''
export const APP_STORE_URL =
  (import.meta.env.VITE_APP_STORE_URL as string | undefined) || ''

/** Visit tokens have no fixed format yet: only a sane length/charset check. */
export const isVisitTokenShape = (token: string) =>
  /^[A-Za-z0-9_-]{8,128}$/.test(token)
