/** Lab ERD §5b. Stage / item statuses are workflow data; these are the fixed enums. */

export enum ShipmentDirection {
  /** Clinic → lab: impressions, models, work going back for a correction. */
  TO_LAB = 'to_lab',
  /** Lab → clinic: try-in work and finished work. */
  TO_CLINIC = 'to_clinic',
}

export enum ShipmentStatus {
  DISPATCHED = 'dispatched',
  /** Some lines received, the rest still open (§14 partial receiving). */
  PARTIALLY_RECEIVED = 'partially_received',
  RECEIVED = 'received',
  LOST = 'lost',
}

export enum ShipmentContents {
  IMPRESSION = 'impression',
  MODEL = 'model',
  FRAMEWORK = 'framework',
  TRYIN = 'tryin',
  FINAL = 'final',
  OTHER = 'other',
}

export enum ShipmentCondition {
  OK = 'ok',
  DAMAGED = 'damaged',
  MISSING = 'missing',
}

export enum QcResult {
  PASS = 'pass',
  FAIL = 'fail',
}

/** Closing note on a stage round. */
export enum StageOutcome {
  APPROVED = 'approved',
  CORRECTION = 'correction',
  /** Final work rejected → the item goes to a remake. */
  REJECTED = 'rejected',
}

export enum RemakeReason {
  SHADE = 'shade',
  FIT = 'fit',
  FRACTURE = 'fracture',
  DESIGN = 'design',
  DAMAGED = 'damaged',
  OTHER = 'other',
}

export enum ResponsibleParty {
  LAB = 'lab',
  CLINIC = 'clinic',
  PATIENT = 'patient',
  UNDETERMINED = 'undetermined',
}

export enum RemakeStatus {
  REQUESTED = 'requested',
  AGREED = 'agreed',
  DISPUTED = 'disputed',
  CLOSED = 'closed',
}

/** Status-history / audit `entity_type` values written by this module. */
export const PRODUCTION_ENTITY = {
  /** Workflow entity type — the engine's adapter key. */
  STAGE: 'stage',
  ASSIGNMENT: 'item_assignment',
  SHIPMENT: 'shipment',
  REMAKE: 'remake_request',
  WARRANTY: 'item_warranty',
} as const;

/** Default warranty when the workflow's `start_warranty` gives no `months`. */
export const DEFAULT_WARRANTY_MONTHS = 12;
export const DEFAULT_WARRANTY_TERMS = 'Standard lab warranty';

export const SHIPMENT_SEQUENCE = { key: 'lab_shipment', prefix: 'SHP' };
