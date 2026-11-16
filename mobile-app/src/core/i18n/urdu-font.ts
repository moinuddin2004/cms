import * as Font from "expo-font";
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { useT, type Locale } from "./i18n";

/**
 * Noto Nastaliq Urdu for the patient space when the language is Urdu (DECISIONS O-06).
 *
 * The font package is NOT a dependency yet (adding packages is reserved for the user):
 *   npx expo install @expo-google-fonts/noto-nastaliq-urdu expo-font
 * Until it is installed the optional `require` below fails quietly and every screen keeps the system
 * font, so the app builds and runs either way. Once installed nothing else needs to change.
 */

export const URDU_FONT_REGULAR = "NotoNastaliqUrdu_400Regular";
export const URDU_FONT_BOLD = "NotoNastaliqUrdu_700Bold";

/** Nastaliq's tall, stacked glyphs need ~1.7-2x line height: the Text wrapper adds Tailwind `leading-loose` (2x) for Urdu. */
export const URDU_LEADING_CLASS = "leading-loose";

type FontModule = Record<string, Font.FontSource | undefined>;

function loadFontModule(): FontModule | null {
  try {
    // Optional dependency: Metro treats a `require` inside try/catch as optional.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@expo-google-fonts/noto-nastaliq-urdu") as FontModule;
  } catch {
    return null;
  }
}

type FontState = "idle" | "loading" | "ready" | "unavailable";
let state: FontState = "idle";
let boldLoaded = false;
const listeners = new Set<() => void>();

function setState(next: FontState): void {
  state = next;
  for (const listener of listeners) listener();
}

/** Start loading once (idempotent). Resolves to whether the font is usable. */
export async function loadUrduFont(): Promise<boolean> {
  if (state === "ready") return true;
  if (state === "unavailable" || state === "loading") return false;
  setState("loading");
  const mod = loadFontModule();
  const regular = mod?.NotoNastaliqUrdu_400Regular;
  const bold = mod?.NotoNastaliqUrdu_700Bold;
  if (!regular) {
    setState("unavailable");
    return false;
  }
  try {
    await Font.loadAsync({
      [URDU_FONT_REGULAR]: regular,
      ...(bold ? { [URDU_FONT_BOLD]: bold } : {}),
    });
    boldLoaded = Boolean(bold);
    setState("ready");
    return true;
  } catch {
    setState("unavailable");
    return false;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export type UrduFont = {
  /** True only inside the patient space, for locale `ur`, once the font is loaded. */
  active: boolean;
  locale: Locale;
  regular: string;
  /** Falls back to the regular family when the package has no bold weight. */
  bold: string;
};

const UrduScopeContext = createContext(false);

/**
 * Wrap the patient space in this: only Text inside it gets Nastaliq (staff screens stay as they are).
 * Also starts loading the font (once) when the language is Urdu.
 */
export function UrduFontScope({ children }: { children: ReactNode }) {
  const { locale } = useT();
  useEffect(() => {
    if (locale === "ur") void loadUrduFont();
  }, [locale]);
  return createElement(UrduScopeContext.Provider, { value: true }, children);
}

/** Font state for the current language; `active: false` = use the system font. */
export function useUrduFont(): UrduFont {
  const { locale } = useT();
  const inScope = useContext(UrduScopeContext);
  const fontState = useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
  return {
    active: inScope && locale === "ur" && fontState === "ready",
    locale,
    regular: URDU_FONT_REGULAR,
    bold: boldLoaded ? URDU_FONT_BOLD : URDU_FONT_REGULAR,
  };
}

/** Test helper. */
export function __resetUrduFontForTests(): void {
  state = "idle";
  boldLoaded = false;
  listeners.clear();
}
