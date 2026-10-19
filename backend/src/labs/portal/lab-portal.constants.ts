import type { AppRequest } from 'src/common/types/app-request';
import { LabMemberRole } from '../enums/lab.enums';

/** Header the lab portal reads the active lab from (lab ERD §13). */
export const LAB_ID_HEADER = 'x-lab-id';

/** Every lab portal route lives under this prefix — never a clinic route. */
export const LAB_PORTAL_PREFIX = 'lab-portal';

/** Clinic tenant headers a portal request must not carry. */
export const CLINIC_CONTEXT_HEADERS = ['x-organization-id', 'x-location-id'];

export const LAB_ROLES_KEY = 'requiredLabRoles';
export const LAB_ANY_KEY = 'labPortalAnyLab';

/** Who is calling a lab portal route. Set by `LabPortalGuard` only. */
export interface LabActorContext {
  userId: string;
  labId: string;
  role: LabMemberRole;
}

export type LabPortalRequest = AppRequest & { labActor?: LabActorContext };
