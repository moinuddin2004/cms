/**
 * The bell's chime: two short tones made with the Web Audio API, so there is
 * no sound file to ship or load. Browsers only allow audio after the user has
 * interacted with the page once — until then `playNotificationChime` stays
 * silent (the toast still shows).
 */

const STORAGE_KEY = 'notifications:sound'
const LAST_PLAYED_KEY = 'notifications:sound:last-id'
const LOCK_NAME = 'notifications-sound'

/** This browser's copy of the user's sound switch (default on). */
export function readSoundPref(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

export function writeSoundPref(on: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off')
  } catch {
    /* storage blocked — the server copy still holds the choice */
  }
}

let ctx: AudioContext | null = null
let unlockBound = false

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  // Not every browser (or test DOM) has Web Audio; Safari < 14.1 only the prefixed one.
  const w = window as unknown as {
    AudioContext?: typeof AudioContext
    webkitAudioContext?: typeof AudioContext
  }
  const Ctor = w.AudioContext ?? w.webkitAudioContext
  if (!Ctor) return null
  ctx ??= new Ctor()
  return ctx
}

/**
 * Resume the audio context on the first click / key press, so a chime that
 * arrives later may play. Safe to call many times.
 */
export function unlockNotificationSound() {
  if (unlockBound || typeof window === 'undefined') return
  unlockBound = true
  const unlock = () => {
    void audioContext()
      ?.resume()
      .catch(() => undefined)
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}

function tone(ac: AudioContext, freq: number, start: number, length: number) {
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length)
  osc.connect(gain).connect(ac.destination)
  osc.start(start)
  osc.stop(start + length + 0.02)
}

function chime() {
  const ac = audioContext()
  if (!ac || ac.state !== 'running') return
  const t = ac.currentTime
  tone(ac, 880, t, 0.18)
  tone(ac, 1318.5, t + 0.12, 0.28)
}

/** True the first time any tab asks for this id (checked under a cross-tab lock). */
function claim(id: string): boolean {
  try {
    if (window.localStorage.getItem(LAST_PLAYED_KEY) === id) return false
    window.localStorage.setItem(LAST_PLAYED_KEY, id)
  } catch {
    /* no storage: every tab plays */
  }
  return true
}

/**
 * Chime once for notification `id`, even with several tabs open: the Web
 * Locks API serialises the check-and-mark across tabs of this origin.
 */
export async function playNotificationChime(id: string) {
  if (!readSoundPref()) return
  try {
    // Web Locks is missing in older browsers and in test DOMs.
    const locks = (navigator as unknown as { locks?: LockManager }).locks
    if (locks) {
      await locks.request(LOCK_NAME, () => {
        if (claim(id)) chime()
      })
      return
    }
    if (claim(id)) chime()
  } catch {
    /* audio is best-effort */
  }
}
