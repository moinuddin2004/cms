export enum LabType {
  EXTERNAL = 'external',
  /** A clinic's own lab — `owner_organization_id` is set. */
  INTERNAL = 'internal',
}

export enum LabStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
}

export enum LabMemberRole {
  LAB_ADMIN = 'lab_admin',
  LAB_TECHNICIAN = 'lab_technician',
}

export enum LabLinkStatus {
  INVITED = 'invited',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
}

/** How much of a patient's identity the lab sees on orders. */
export enum PatientDataLevel {
  FULL_NAME = 'full_name',
  CODE_ONLY = 'code_only',
}

/** Status-history / audit `entity_type` values written by this module. */
export const LAB_ENTITY = {
  LAB: 'lab',
  LAB_MEMBER: 'lab_member',
  LAB_CLINIC_LINK: 'lab_clinic_link',
} as const;
