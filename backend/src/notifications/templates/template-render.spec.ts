import {
  NotificationChannel as C,
  NotificationLanguage as L,
} from '../notifications.enums';
import { NOTIFICATION_EVENT_SEEDS } from '../seeds/notification-events.seed';
import { COMMON_VARIABLES } from '../notifications.enums';
import {
  pickTemplate,
  placeholdersOf,
  renderTemplate,
  TemplateCandidate,
} from './template-render';

describe('template rendering', () => {
  it('fills placeholders and blanks unknown ones', () => {
    expect(
      renderTemplate('Dear {patient_name}, {clinic_name} {missing} says hi', {
        patient_name: 'Ali',
        clinic_name: 'Smile',
      }),
    ).toBe('Dear Ali, Smile says hi');
  });

  it('lists placeholders across subject and body once each', () => {
    expect(
      placeholdersOf('Order {order_no}', '{order_no} for {patient_name}', null),
    ).toEqual(['order_no', 'patient_name']);
  });

  it('every seeded template only uses its event variables', () => {
    for (const e of NOTIFICATION_EVENT_SEEDS) {
      const allowed = new Set<string>([...COMMON_VARIABLES, ...e.variables]);
      for (const v of placeholdersOf(e.title, e.body)) {
        expect(`${e.code}:${allowed.has(v)}`).toBe(`${e.code}:true`);
      }
    }
  });
});

describe('pickTemplate', () => {
  const t = (
    id: string,
    own: boolean,
    channel: C,
    language: L,
  ): TemplateCandidate => ({
    id,
    organizationId: own ? 'org' : null,
    channel,
    language,
    subject: null,
    body: id,
    providerTemplateRef: null,
  });
  const all = [
    t('platform-en', false, C.WHATSAPP, L.EN),
    t('platform-ur', false, C.WHATSAPP, L.ROMAN_UR),
    t('own-en', true, C.WHATSAPP, L.EN),
    t('sms-en', false, C.SMS, L.EN),
  ];

  it("prefers the clinic's own in the recipient's language, then the platform's", () => {
    expect(pickTemplate(all, C.WHATSAPP, L.ROMAN_UR)?.id).toBe('platform-ur');
    expect(
      pickTemplate(
        [...all, t('own-ur', true, C.WHATSAPP, L.ROMAN_UR)],
        C.WHATSAPP,
        L.ROMAN_UR,
      )?.id,
    ).toBe('own-ur');
  });

  it('falls back to English, own before platform', () => {
    expect(pickTemplate(all, C.WHATSAPP, L.UR)?.id).toBe('own-en');
    expect(pickTemplate(all, C.SMS, L.UR)?.id).toBe('sms-en');
    expect(pickTemplate(all, C.EMAIL, L.EN)).toBeNull();
  });
});
