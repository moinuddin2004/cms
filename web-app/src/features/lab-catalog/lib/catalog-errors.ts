import { toast } from 'sonner'

/** Friendly messages for the backend's catalog error codes. */
const MESSAGES: Record<string, string> = {
  STALE_VERSION:
    'Someone else changed this just now. The latest version is loaded — try again.',
  LAB_SERVICE_EXISTS: 'This lab already has a service with this code.',
  LAB_SERVICE_OPTION_EXISTS:
    'This service already has an option with this code.',
  SERVICE_CATEGORY_EXISTS: 'A category with this code already exists.',
  LAB_SERVICE_DEFINITION_INVALID:
    'Pick an active platform form, workflow and stage template of the same specialty.',
  LAB_PRICE_OVERLAP:
    'Another price is already set for some of these dates. End or void it first.',
  LAB_PRICE_LOCKED:
    'This price is already in use. Set an end date and add a new price instead.',
  LAB_PRICE_MISSING: 'The lab has no price for this service on that date.',
  LAB_NOT_LINKED:
    'This clinic does not work with this lab (or the lab is not active yet).',
  LAB_SERVICE_ALREADY_MAPPED:
    'This lab service is already billed as another treatment.',
  SERVICE_MAPPING_EXISTS:
    'This lab service is already mapped to this treatment.',
  CLINIC_TREATMENT_INACTIVE:
    'This treatment is no longer offered by your clinic.',
  LAB_SERVICE_INACTIVE: 'This lab no longer offers that service.',
  ORDER_TEMPLATE_FORBIDDEN:
    'Only clinic admins can share or change shared templates.',
}

/** `{ code, message }` of a catalog API error. */
export function catalogError(err: unknown): { code?: string; message: string } {
  const res = (
    err as {
      response?: {
        data?: {
          message?: string
          error?: { code?: string; message?: string }
        }
      }
    } | null
  )?.response?.data
  const code = res?.error?.code
  return {
    code,
    message:
      (code && MESSAGES[code]) ||
      res?.error?.message ||
      res?.message ||
      (err instanceof Error ? err.message : '') ||
      'Something went wrong',
  }
}

export const toastCatalogError = (err: unknown) =>
  toast.error(catalogError(err).message)
