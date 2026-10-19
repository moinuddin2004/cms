import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Eye, Loader2, RotateCcw, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { answersToSend, initialAnswers } from '../lib/form-preview'
import { toastStudioError } from '../lib/studio-errors'
import { formSchemasApi } from '../services/studio.api'
import type { FieldDef, FormDataResult } from '../types'
import { DynamicFormFields } from './DynamicFormFields'
import { IssuesList } from './IssuesList'

/**
 * Live preview of a form definition: one input per field type, hiding
 * fields whose `visibleIf` does not match. "Check answers" sends them to
 * the server validator for the saved version — the same check orders get.
 */
export function FormPreview({
  formSchemaId,
  versionId,
  fields,
  ui,
  stale,
}: {
  formSchemaId: string
  versionId: string
  fields: FieldDef[]
  ui: unknown
  /** The editor has unsaved changes: the server checks the saved version. */
  stale: boolean
}) {
  const [answers, setAnswers] = useState<Record<string, unknown>>(() =>
    initialAnswers(fields),
  )
  const [result, setResult] = useState<FormDataResult | null>(null)
  /** Bumped on reset so inputs with their own text state start over. */
  const [round, setRound] = useState(0)
  const check = useMutation({
    mutationFn: () =>
      formSchemasApi.validate(
        formSchemaId,
        versionId,
        answersToSend(fields, answers),
      ),
    onSuccess: setResult,
    onError: toastStudioError,
  })

  const set = (key: string, value: unknown) => {
    setAnswers((a) => ({ ...a, [key]: value }))
    setResult(null)
  }
  const errorFor = (key: string) =>
    result?.issues.find((i) => i.path === key)?.message

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Eye className="size-4 text-text-3" /> Live preview
        </h3>
        <TooltipButton
          tooltip="Reset answers to the defaults"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => {
            setAnswers(initialAnswers(fields))
            setResult(null)
            setRound((r) => r + 1)
          }}
        >
          <RotateCcw className="size-4" />
        </TooltipButton>
      </div>

      {fields.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-text-3">
          Add fields to <code>schemaJson.fields</code> to see them here.
        </p>
      ) : (
        <form
          className="space-y-6"
          aria-label="Form preview"
          onSubmit={(e) => {
            e.preventDefault()
            check.mutate()
          }}
        >
          <DynamicFormFields
            fields={fields}
            ui={ui}
            answers={answers}
            onChange={set}
            errorFor={errorFor}
            resetKey={round}
          />

          <div className="space-y-2 border-t border-border pt-4">
            <Button type="submit" variant="outline" disabled={check.isPending}>
              {check.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShieldCheck className="size-4" />
              )}
              Check answers
            </Button>
            {stale && (
              <p className="text-xs text-text-3">
                The server checks the last saved draft — save to check your
                latest edits.
              </p>
            )}
            {result &&
              (result.definitionIssues.length && !result.ok ? (
                <IssuesList
                  issues={result.definitionIssues}
                  title="The saved definition has problems"
                />
              ) : (
                <IssuesList
                  issues={result.issues}
                  title="Answers rejected"
                  okText="These answers pass the server check."
                />
              ))}
          </div>
        </form>
      )}
    </div>
  )
}
