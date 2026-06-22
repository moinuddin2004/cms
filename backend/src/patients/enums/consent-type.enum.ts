/**
 * Consent categories used across the patient consent workflow.
 *
 * NOTE: These values are the contract with the web-app `ConsentType` enum
 * (web-app/src/features/patients/types.ts). Keep the two in sync — a mismatch
 * makes every consent POST fail `@IsEnum` validation with a 400.
 */
export enum ConsentType {
  GENERAL = 'general_treatment',
  EXTRACTION = 'extraction',
  IMPLANT = 'implant',
  ROOT_CANAL = 'root_canal',
  ORTHODONTIC = 'orthodontic',
  SEDATION = 'sedation',
  PHOTO_RELEASE = 'photo_release',
}
