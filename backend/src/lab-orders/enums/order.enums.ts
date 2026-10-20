/** Lab ERD §5a. Order statuses are workflow data; these are the fixed enums. */

export enum OrderPriority {
  NORMAL = 'normal',
  URGENT = 'urgent',
}

export enum MessageSide {
  CLINIC = 'clinic',
  LAB = 'lab',
}

export enum MessageKind {
  NOTE = 'note',
  CLARIFICATION_REQUEST = 'clarification_request',
  REPLY = 'reply',
}

export enum ChargeKind {
  RUSH = 'rush',
  MATERIAL = 'material',
  SHIPPING = 'shipping',
  OTHER = 'other',
}

export enum ChargeStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum AttachmentVisibility {
  /** Clinic staff only. */
  INTERNAL = 'internal',
  /** Clinic + the order's lab. */
  LAB_SHARED = 'lab_shared',
  /** Clinic + lab + the patient (later: patient portal). */
  PATIENT_SHARED = 'patient_shared',
}

/** What an attachment hangs off (polymorphic; checked in the app layer). */
export enum AttachmentEntity {
  LAB_ORDER = 'lab_order',
  LAB_ORDER_ITEM = 'lab_order_item',
}

/** Status-history / audit `entity_type` values written by this module. */
export const ORDER_ENTITY = {
  /** Workflow entity types — the engine's adapter keys. */
  ORDER: 'order',
  ITEM: 'item',
  REVISION: 'order_revision',
  MESSAGE: 'order_message',
  CHARGE: 'order_charge_request',
  ATTACHMENT: 'attachment',
} as const;
