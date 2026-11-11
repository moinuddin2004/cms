import { ConfigScope } from 'src/settings-registry/entities/config-value.entity';
import { defineSetting, s } from 'src/settings-registry/setting-definition';

const { ORG } = ConfigScope;

/**
 * What a patient may see in the patient app (owner edits these under
 * Settings → Patient app). Read by the `/patient-api` read services.
 */
export const PATIENT_APP_SETTINGS = {
  /** Invoices, payments and balance in the patient app. */
  showBilling: defineSetting<boolean>('patient_app.show_billing', {
    schema: s.boolean(),
    default: true,
    scopes: [ORG],
    lockable: false,
  }),
  /** Diagnosis and treatment names in the patient app. */
  showDiagnosis: defineSetting<boolean>('patient_app.show_diagnosis', {
    schema: s.boolean(),
    default: true,
    scopes: [ORG],
    lockable: false,
  }),
};

export const PATIENT_APP_SETTING_KEYS = Object.values(
  PATIENT_APP_SETTINGS,
).map((d) => d.key);
