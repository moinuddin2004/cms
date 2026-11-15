import * as Clipboard from 'expo-clipboard';

/**
 * Explicit "Copy" actions only (docs/03 §2.9: PHI is never copied automatically).
 * Returns whether the text reached the clipboard; never throws, never logs the text.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    return await Clipboard.setStringAsync(text);
  } catch {
    return false;
  }
}
