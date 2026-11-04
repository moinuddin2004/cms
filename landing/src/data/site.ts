/**
 * Site wide facts. Anything marked PLACEHOLDER still needs a real value
 * from the business before launch.
 */
const appUrl = (import.meta.env.PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export const SITE = {
  /** PLACEHOLDER: the product name is not decided yet. */
  name: 'Clinicly',
  tagline: 'Clinic management software for every kind of clinic',
  description:
    'Appointments, patient queue, records, billing, labs and payroll for clinics in Pakistan. One branch or many. Free plan for small clinics.',
  appUrl,
  signupUrl: `${appUrl}/register`,
  loginUrl: `${appUrl}/login`,
  /** PLACEHOLDER: real sales inbox. */
  email: 'hello@clinicly.pk',
  /** PLACEHOLDER: WhatsApp number in international format, e.g. 923001234567. null hides the button. */
  whatsapp: null as string | null,
};

export const NAV_LINKS = [
  { href: '/#features', label: 'Features', id: 'features' },
  { href: '/#visit', label: 'How it works', id: 'visit' },
  { href: '/pricing', label: 'Pricing', id: 'pricing' },
  { href: '/#faq', label: 'FAQ', id: 'faq' },
];
