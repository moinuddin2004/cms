import {
  NotificationChannel,
  NotificationLanguage,
} from '../notifications.enums';

const PLACEHOLDER = /\{([a-z_][a-z0-9_]*)\}/gi;

/** Placeholder names used in `text`, in order of first use. */
export function placeholdersOf(
  ...texts: (string | null | undefined)[]
): string[] {
  const found = new Set<string>();
  for (const text of texts) {
    for (const m of (text ?? '').matchAll(PLACEHOLDER)) found.add(m[1]);
  }
  return [...found];
}

/** Fills `{name}` placeholders; unknown ones become empty so no raw braces reach a patient. */
export function renderTemplate(
  text: string,
  variables: Record<string, string>,
): string {
  return text
    .replace(PLACEHOLDER, (_, name: string) => variables[name] ?? '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export interface TemplateCandidate {
  id: string;
  organizationId: string | null;
  channel: NotificationChannel;
  language: NotificationLanguage;
  subject: string | null;
  body: string;
  providerTemplateRef: string | null;
}

/**
 * The template for (channel, language): the clinic's own in that language,
 * then the platform's, then the same two in English.
 */
export function pickTemplate<T extends TemplateCandidate>(
  templates: T[],
  channel: NotificationChannel,
  language: NotificationLanguage,
): T | null {
  const order: [boolean, NotificationLanguage][] = [
    [true, language],
    [false, language],
    [true, NotificationLanguage.EN],
    [false, NotificationLanguage.EN],
  ];
  for (const [own, lang] of order) {
    const hit = templates.find(
      (t) =>
        t.channel === channel &&
        t.language === lang &&
        (t.organizationId !== null) === own,
    );
    if (hit) return hit;
  }
  return null;
}
