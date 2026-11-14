/**
 * Explicit "Copy" actions (docs/03 §2.9: PHI is never copied automatically).
 *
 * `expo-clipboard` is not in the lockfile yet and packages may not be added from
 * a card (see HANDOFF M1-12): until the architect runs `npx expo install expo-clipboard`,
 * this reports "unavailable" and the caller shows an honest toast. After the install
 * the body becomes `await Clipboard.setStringAsync(text); return true;`.
 */
export async function copyText(_text: string): Promise<boolean> {
  return false;
}
