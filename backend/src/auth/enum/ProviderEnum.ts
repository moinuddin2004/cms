/**
 * How a user account was created. GOOGLE = signed up with Google or added by
 * a clinic as a Google-only login (no password); such an account is linked
 * to the matching Google account on its first Google sign-in.
 */
export enum ProviderEnum {
  GOOGLE = 'google',
  LOCAL = 'local',
}
