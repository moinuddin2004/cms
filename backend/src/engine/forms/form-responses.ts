import type { FormSchemaVersion } from '../entities/form-schema-version.entity';
import type { DefinitionStatus } from '../enums/engine.enums';
import type {
  FormDefinition,
  FormIssue,
  FormUi,
  Promotions,
} from './form-definition.types';

export interface FormSchemaSummary {
  id: string;
  specialty: { id: string; code: string; name: string };
  /** Null = platform default. */
  organization: { id: string; name: string } | null;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  current: { id: string; versionNo: number; publishedAt: Date } | null;
  draft: { id: string; versionNo: number } | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FormSchemaDetail extends FormSchemaSummary {
  versions: {
    id: string;
    versionNo: number;
    status: DefinitionStatus;
    publishedAt: Date | null;
    retiredAt: Date | null;
    createdAt: Date;
  }[];
}

export interface FormVersionResponse {
  id: string;
  formSchemaId: string;
  versionNo: number;
  status: DefinitionStatus;
  schemaJson: FormDefinition;
  uiJson: FormUi | null;
  promotions: Promotions;
  publishedAt: Date | null;
  retiredAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  /** Problems blocking publish (drafts only; published versions have none). */
  issues: FormIssue[];
}

/** A clinic's view: the version to fill in for one form code. */
export interface CurrentForm {
  formSchemaId: string;
  code: string;
  name: string;
  description: string | null;
  specialtyCode: string;
  /** True when the organization's own form overrides the platform default. */
  isOrganizationForm: boolean;
  versionId: string;
  versionNo: number;
  schemaJson: FormDefinition;
  uiJson: FormUi | null;
}

export function toVersionResponse(
  v: FormSchemaVersion,
  issues: FormIssue[],
): FormVersionResponse {
  return {
    id: v.id,
    formSchemaId: v.formSchemaId,
    versionNo: v.versionNo,
    status: v.status,
    schemaJson: v.schemaJson,
    uiJson: v.uiJson,
    promotions: v.promotions,
    publishedAt: v.publishedAt,
    retiredAt: v.retiredAt,
    version: v.version,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
    issues,
  };
}
