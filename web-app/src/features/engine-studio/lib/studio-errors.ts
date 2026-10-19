import { toast } from 'sonner'
import type { Issue } from '../types'

/** Friendly messages for the engine's error codes. */
const MESSAGES: Record<string, string> = {
  STALE_VERSION:
    'Someone else changed this just now. The latest version is loaded — try again.',
  FORM_SCHEMA_EXISTS: 'A form with this code already exists for this owner.',
  FORM_DRAFT_EXISTS: 'This form already has a draft — open it instead.',
  FORM_VERSION_NOT_DRAFT: 'Only a draft can be changed.',
  FORM_VERSION_NOT_PUBLISHED: 'Only the published version can be retired.',
  WORKFLOW_TEMPLATE_EXISTS:
    'A workflow with this code already exists for this owner.',
  WORKFLOW_DRAFT_EXISTS: 'This workflow already has a draft — open it instead.',
  WORKFLOW_VERSION_NOT_DRAFT: 'Only a draft can be changed.',
  WORKFLOW_VERSION_NOT_PUBLISHED: 'Only the published version can be retired.',
  STAGE_TEMPLATE_EXISTS: 'A stage template with this code already exists.',
  SPECIALTY_NOT_FOUND: 'That specialty no longer exists.',
  ORGANIZATION_NOT_FOUND: 'That organization no longer exists.',
}

interface ApiErrorBody {
  message?: string
  error?: { code?: string; message?: string; issues?: Issue[] }
}

/** `{ code, message, issues }` of an engine API error. */
export function studioError(err: unknown): {
  code?: string
  message: string
  issues: Issue[]
} {
  const res = (err as { response?: { data?: ApiErrorBody } } | null)?.response
    ?.data
  const code = res?.error?.code
  return {
    code,
    issues: res?.error?.issues ?? [],
    message:
      (code && MESSAGES[code]) ||
      res?.error?.message ||
      res?.message ||
      (err instanceof Error ? err.message : '') ||
      'Something went wrong',
  }
}

export const toastStudioError = (err: unknown) =>
  toast.error(studioError(err).message)
