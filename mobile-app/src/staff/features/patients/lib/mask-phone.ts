/**
 * Masks the middle of a phone number for list rows (docs/06 S-04), on digits
 * only (separators and spaces are ignored; a leading `+` is kept):
 * `03001234567` → `0300•••4567`, `+923001234567` → `+9230•••4567`.
 * 4 + 4 digits are shown only when at least 4 digits stay hidden (≥ 12 digits);
 * otherwise 2 + 2 (≥ 5 digits). With ≤ 4 digits only the last 2 are kept
 * (nothing for a single digit). Empty / null / no digits → `''`.
 */
const HIDDEN = '•••';

export function maskPhone(phone: string | null | undefined): string {
  const raw = (phone ?? '').trim();
  const plus = raw.startsWith('+') ? '+' : '';
  const digits = raw.replace(/\D/g, '');
  const n = digits.length;
  if (n === 0) return '';
  if (n <= 4) {
    return HIDDEN + digits.slice(n - Math.min(2, n - 1));
  }
  const edge = n - 8 >= 3 ? 4 : 2;
  return plus + digits.slice(0, edge) + HIDDEN + digits.slice(-edge);
}
