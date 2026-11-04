import { create } from 'zustand'
import type { GoogleProfile, JoinableClinic } from '../services/google.api'

/**
 * A verified Google account with no login yet, carried from the login
 * page to /register (create a clinic, or ask to join one). Memory only;
 * the ID token expires after an hour, the server checks it again.
 */
interface GoogleSignupState {
  credential: string | null
  profile: GoogleProfile | null
  joinableClinics: JoinableClinic[]
  start: (
    credential: string,
    profile: GoogleProfile,
    joinableClinics: JoinableClinic[],
  ) => void
  clear: () => void
}

export const useGoogleSignupStore = create<GoogleSignupState>()((set) => ({
  credential: null,
  profile: null,
  joinableClinics: [],
  start: (credential, profile, joinableClinics) =>
    set({ credential, profile, joinableClinics }),
  clear: () => set({ credential: null, profile: null, joinableClinics: [] }),
}))
