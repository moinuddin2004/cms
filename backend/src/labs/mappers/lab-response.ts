import { Lab } from '../entities/lab.entity';
import { LabClinicLink } from '../entities/lab-clinic-link.entity';
import { LabMember } from '../entities/lab-member.entity';
import {
  LabLinkStatus,
  LabMemberRole,
  LabStatus,
  LabType,
  PatientDataLevel,
} from '../enums/lab.enums';

/** Fields the audit trail snapshots for each entity. */
export const LAB_AUDIT_FIELDS = [
  'labType',
  'ownerOrganizationId',
  'name',
  'phone',
  'whatsappPhone',
  'email',
  'city',
  'address',
  'status',
] as const satisfies readonly (keyof Lab)[];

export const MEMBER_AUDIT_FIELDS = [
  'labId',
  'userId',
  'role',
  'isActive',
] as const satisfies readonly (keyof LabMember)[];

export const LINK_AUDIT_FIELDS = [
  'labId',
  'status',
  'paymentTermsDays',
  'patientDataLevel',
  'notes',
] as const satisfies readonly (keyof LabClinicLink)[];

/** What a clinic may know about a lab — never other clinics' data. */
export interface LabSummary {
  id: string;
  name: string;
  labType: LabType;
  phone: string | null;
  whatsappPhone: string | null;
  email: string | null;
  /** The contact address was confirmed; only then does email go to it. */
  emailVerified: boolean;
  city: string | null;
  address: string | null;
  status: LabStatus;
}

export interface LabResponse extends LabSummary {
  ownerOrganization: { id: string; name: string } | null;
  memberCount: number;
  activeLinkCount: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LabMemberResponse {
  id: string;
  labId: string;
  role: LabMemberRole;
  isActive: boolean;
  user: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
  };
  version: number;
  createdAt: Date;
}

export interface LabLinkResponse {
  id: string;
  status: LabLinkStatus;
  paymentTermsDays: number;
  patientDataLevel: PatientDataLevel;
  activatedAt: Date | null;
  notes: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  lab: LabSummary;
}

/** A clinic's view of its links from the platform side (lab detail page). */
export interface LabLinkAdminResponse extends Omit<LabLinkResponse, 'lab'> {
  organization: { id: string; name: string };
}

export interface DirectoryLab extends LabSummary {
  /** This clinic's link, when it already has one. */
  link: { id: string; status: LabLinkStatus } | null;
}

export function toLabSummary(lab: Lab): LabSummary {
  return {
    id: lab.id,
    name: lab.name,
    labType: lab.labType,
    phone: lab.phone,
    whatsappPhone: lab.whatsappPhone,
    email: lab.email,
    emailVerified: !!lab.email && !!lab.emailVerifiedAt,
    city: lab.city,
    address: lab.address,
    status: lab.status,
  };
}

export function toLabResponse(
  lab: Lab,
  counts: { memberCount: number; activeLinkCount: number },
): LabResponse {
  return {
    ...toLabSummary(lab),
    ownerOrganization: lab.ownerOrganization
      ? { id: lab.ownerOrganization.id, name: lab.ownerOrganization.name }
      : null,
    ...counts,
    version: lab.version,
    createdAt: lab.createdAt,
    updatedAt: lab.updatedAt,
  };
}

export function toMemberResponse(m: LabMember): LabMemberResponse {
  return {
    id: m.id,
    labId: m.labId,
    role: m.role,
    isActive: m.isActive,
    user: {
      id: m.user.uuid,
      name: m.user.name ?? null,
      email: m.user.email,
      phone: m.user.phone ?? null,
    },
    version: m.version,
    createdAt: m.createdAt,
  };
}

function linkFields(link: LabClinicLink): Omit<LabLinkResponse, 'lab'> {
  return {
    id: link.id,
    status: link.status,
    paymentTermsDays: link.paymentTermsDays,
    patientDataLevel: link.patientDataLevel,
    activatedAt: link.activatedAt,
    notes: link.notes,
    version: link.version,
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
  };
}

/** `link.lab` must be loaded. */
export function toLinkResponse(link: LabClinicLink): LabLinkResponse {
  return { ...linkFields(link), lab: toLabSummary(link.lab) };
}

/** `link.organization` must be loaded. */
export function toLinkAdminResponse(link: LabClinicLink): LabLinkAdminResponse {
  return {
    ...linkFields(link),
    organization: { id: link.organization.id, name: link.organization.name },
  };
}
