export interface EmergencyNumber {
  /** Display name from config; null means show the translated default label. */
  label: string | null;
  number: string;
}

/**
 * Default when nothing is configured: 112, the emergency number GSM phones route
 * to the local service in most countries. It is NOT a claim about the patient's
 * country; set `EXPO_PUBLIC_EMERGENCY_NUMBERS` per build to override it.
 */
export const DEFAULT_EMERGENCY_NUMBERS: EmergencyNumber[] = [{ label: null, number: '112' }];

/**
 * Parses `EXPO_PUBLIC_EMERGENCY_NUMBERS`: entries separated by `;`, each
 * `Label:number` or just `number` (e.g. `Ambulance:1122;Police:15`). Bad entries are
 * skipped; nothing usable gives the default.
 */
export function parseEmergencyNumbers(raw: string | undefined): EmergencyNumber[] {
  const out: EmergencyNumber[] = [];
  for (const part of (raw ?? '').split(';')) {
    const entry = part.trim();
    if (!entry) continue;
    const i = entry.lastIndexOf(':');
    const label = i >= 0 ? entry.slice(0, i).trim() : '';
    const number = (i >= 0 ? entry.slice(i + 1) : entry).trim();
    if (!/^\+?[0-9][0-9 ()-]{1,18}$/.test(number)) continue;
    out.push({ label: label || null, number });
  }
  return out.length > 0 ? out : DEFAULT_EMERGENCY_NUMBERS;
}

export const emergencyNumbers = (): EmergencyNumber[] =>
  parseEmergencyNumbers(process.env.EXPO_PUBLIC_EMERGENCY_NUMBERS);
