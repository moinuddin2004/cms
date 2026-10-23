import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  importPatients,
  parsePatientImportFile,
} from '../services/patients.api'
import type {
  DuplicateStrategy,
  PatientImportResult,
  PatientImportRow,
  PatientImportRowResult,
} from '../types'
import { IMPORT_BATCH_SIZE } from '../utils/patientImport'

function apiMessage(err: unknown, fallback: string): string {
  const message = (
    err as { response?: { data?: { message?: unknown } } } | undefined
  )?.response?.data?.message
  if (Array.isArray(message)) return message.join('; ')
  return typeof message === 'string' && message ? message : fallback
}

/** Step 1: upload a file to be read (nothing is stored). */
export function useParsePatientImport() {
  return useMutation({
    mutationFn: parsePatientImportFile,
    onError: (err) => {
      toast.error(apiMessage(err, 'Could not read the file'))
    },
  })
}

/** Step 3: check every mapped row without creating anything. */
export function usePatientImportDryRun() {
  return useMutation({
    mutationFn: (vars: {
      rows: PatientImportRow[]
      duplicateStrategy: DuplicateStrategy
    }) => importPatients({ ...vars, dryRun: true, offset: 0 }),
    onError: (err) => {
      toast.error(apiMessage(err, 'Could not check the file'))
    },
  })
}

interface RunImportVars {
  rows: PatientImportRow[]
  duplicateStrategy: DuplicateStrategy
  onProgress: (done: number, total: number) => void
}

/**
 * Step 4: create the patients in batches of IMPORT_BATCH_SIZE. A batch whose
 * request fails is reported as failed rows and the import carries on.
 */
export function useRunPatientImport() {
  return useMutation({
    mutationFn: async ({
      rows,
      duplicateStrategy,
      onProgress,
    }: RunImportVars): Promise<PatientImportResult> => {
      const results: PatientImportRowResult[] = []
      onProgress(0, rows.length)
      for (let offset = 0; offset < rows.length; offset += IMPORT_BATCH_SIZE) {
        const batch = rows.slice(offset, offset + IMPORT_BATCH_SIZE)
        try {
          const res = await importPatients({
            rows: batch,
            dryRun: false,
            duplicateStrategy,
            offset,
          })
          results.push(...res.rows)
        } catch (err) {
          const reason = apiMessage(
            err,
            'The server could not import this batch',
          )
          batch.forEach((_, i) =>
            results.push({
              index: offset + i,
              status: 'error',
              errors: [reason],
            }),
          )
        }
        onProgress(Math.min(offset + batch.length, rows.length), rows.length)
      }
      const count = (s: PatientImportRowResult['status']) =>
        results.filter((r) => r.status === s).length
      return {
        dryRun: false,
        rows: results,
        totals: {
          total: results.length,
          created: count('created'),
          wouldCreate: 0,
          duplicates: count('duplicate'),
          errors: count('error'),
        },
      }
    },
    onError: (err) => {
      toast.error(apiMessage(err, 'Import failed'))
    },
  })
}
