import type { DefinitionStatus } from '../enums/engine.enums';
import type { SimulationRun } from './workflow-definition.checker';
import type {
  DefinitionIssue,
  WorkflowDefinition,
  WorkflowEntityType,
} from './workflow.types';

export interface WorkflowTemplateSummary {
  id: string;
  specialty: { id: string; code: string; name: string };
  organization: { id: string; name: string } | null;
  entityType: WorkflowEntityType;
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

export interface WorkflowTemplateDetail extends WorkflowTemplateSummary {
  versions: {
    id: string;
    versionNo: number;
    status: DefinitionStatus;
    publishedAt: Date | null;
    retiredAt: Date | null;
    createdAt: Date;
  }[];
}

export interface WorkflowVersionResponse {
  id: string;
  workflowTemplateId: string;
  versionNo: number;
  status: DefinitionStatus;
  definition: WorkflowDefinition;
  publishedAt: Date | null;
  retiredAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  /** Problems blocking publish (drafts only). */
  issues: DefinitionIssue[];
  /** Test run: shortest path to each terminal state. */
  simulation: SimulationRun[];
}
