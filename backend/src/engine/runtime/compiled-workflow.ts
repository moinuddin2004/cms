import type { StateCategory } from '../workflows/workflow.types';

export interface CompiledState {
  id: string;
  code: string;
  name: string;
  category: StateCategory;
  isTerminal: boolean;
}

export interface CompiledTransition {
  id: string;
  from: string;
  to: string;
  action: string;
  allowedRoles: string[];
  allowedSides: string[];
  requiredFields: string[];
  requiresReason: boolean;
  effects: { code: string; params: Record<string, unknown> }[];
}

/** A published workflow version, read once and cached (versions are immutable). */
export interface CompiledWorkflow {
  versionId: string;
  entityType: string;
  states: Map<string, CompiledState>;
  transitions: CompiledTransition[];
}
