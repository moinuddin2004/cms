/**
 * Masks the middle of a phone number for list rows (docs/06 S-04):
 * `03001234567` → `0300•••4567` (first 4 + last 4 kept). Shorter numbers keep
 * less so something is always hidden: 7–8 chars keep 2 + 2, ≤ 6 keep only the
 * last 2 (or nothing for a single character). Empty / null → `''`.
 */
const HIDDEN = '•••';

export function maskPhone(phone: string | null | undefined): string {
  const chars = Array.from((phone ?? '').trim());
  if (chars.length === 0) return '';
  if (chars.length <= 6) {
    const keep = Math.min(2, chars.length - 1);
    return HIDDEN + chars.slice(chars.length - keep).join('');
  }
  if (chars.length <= 8) {
    return chars.slice(0, 2).join('') + HIDDEN + chars.slice(-2).join('');
  }
  return chars.slice(0, 4).join('') + HIDDEN + chars.slice(-4).join('');
}
