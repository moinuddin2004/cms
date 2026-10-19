import { validateFormData } from 'src/engine/forms/form-data.validator';
import type {
  FormDefinition,
  FormIssue,
} from 'src/engine/forms/form-definition.types';

/** One line of a saved order: a lab service and the answers to pre-fill. */
export interface OrderTemplateItem {
  labServiceId: string;
  optionIds: string[];
  quantity: number;
  rush: boolean;
  /**
   * Code of the form the answers were checked against (the service's
   * form). Sprint 6 re-validates them against the version current at
   * submit; null when the service has no form.
   */
  formCode: string | null;
  answers: Record<string, unknown>;
}

/** `order_templates.template_json`. Versioned so the shape can evolve. */
export interface OrderTemplateBody {
  schemaVersion: 1;
  items: OrderTemplateItem[];
  notes: string | null;
}

/**
 * Template answers are a partial pre-fill: the doctor adds the patient's
 * teeth, shade … when ordering, so missing required answers are fine here.
 * Everything that IS given must be valid for the form — unknown keys,
 * wrong types and bad options are refused — and is stored normalised.
 */
export function validateTemplateAnswers(
  def: FormDefinition,
  answers: unknown,
): { issues: FormIssue[]; value: Record<string, unknown> } {
  const result = validateFormData(def, answers);
  return {
    issues: result.issues.filter((i) => i.code !== 'required'),
    value: result.value,
  };
}
