/**
 * Deterministic avatar colour (docs/05 §5): the same name always gets the same
 * tint, picked from a fixed palette of 8 token-based classes — never random
 * per render. Full literal class names so Tailwind can see them.
 */
export const AVATAR_TINTS = [
  'bg-primary/20',
  'bg-info/20',
  'bg-success/20',
  'bg-warning/20',
  'bg-destructive/20',
  'bg-secondary',
  'bg-accent',
  'bg-muted',
] as const;

/** Index (0–7) of the tint for `name`; a simple, stable string hash. */
export function avatarTintIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash % AVATAR_TINTS.length;
}

/** Up to two initials from the first two words of `name`; "?" when empty. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = Array.from(words[0])[0] ?? '';
  const second = words.length > 1 ? (Array.from(words[1])[0] ?? '') : '';
  return (first + second).toUpperCase();
}
