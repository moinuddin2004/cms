import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Plus,
  Rocket,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { MultiSelect } from '@/components/shared/MultiSelect'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { cn } from '@/lib/utils'
import { diffWorkflow, stableStringify } from '../lib/diff'
import {
  issuesByRow,
  move,
  normalizeDefinition,
  removeState,
  updateState,
  updateTransition,
} from '../lib/workflow-edit'
import {
  useDiscardWorkflowDraft,
  usePublishWorkflowVersion,
  useSaveWorkflowDraft,
  useWorkflowEffects,
  useWorkflowVersion,
} from '../hooks/useWorkflows'
import { useUnsavedChangesWarning } from '../hooks/useUnsavedChangesWarning'
import {
  DERIVED_ACTION,
  KNOWN_ROLES,
  STATE_CATEGORIES,
  TRANSITION_SIDES,
} from '../types'
import type {
  Issue,
  StateCategory,
  TransitionSide,
  WorkflowDefinition,
  WorkflowTemplateDetail,
  WorkflowVersion,
} from '../types'
import { IssuesList } from './IssuesList'
import { SimulationPanel } from './SimulationPanel'
import { DefinitionStatusBadge } from './studio-badges'

const ROLE_OPTIONS = KNOWN_ROLES.map((r) => ({
  value: r,
  label: r.replace(/_/g, ' '),
}))
const SIDE_OPTIONS = TRANSITION_SIDES.map((s) => ({ value: s, label: s }))

/**
 * One workflow version as two editable tables — states and transitions
 * (lab ERD §18) — with the server's publish checks and test run. Drafts
 * save with an optimistic `version`; published / retired are read-only.
 */
export function WorkflowVersionEditor({
  template,
  version,
  onDiscarded,
}: {
  template: WorkflowTemplateDetail
  version: WorkflowVersion
  onDiscarded: () => void
}) {
  const isDraft = version.status === 'draft'
  const ro = !isDraft
  // Re-seed only when another version opens or a save bumps `version` —
  // a background refetch of the same version must not wipe unsaved edits.
  const saved = useMemo(
    () => normalizeDefinition(version.definition),
    [version.id, version.version],
  )
  const [def, setDef] = useState<WorkflowDefinition>(saved)
  useEffect(() => setDef(saved), [saved])
  const dirty = isDraft && stableStringify(def) !== stableStringify(saved)
  useUnsavedChangesWarning(dirty)

  const effects = useWorkflowEffects()
  const effectOptions = (effects.data ?? []).map((e) => ({
    value: e.code,
    label: e.isFinancial ? `${e.code} (financial)` : e.code,
  }))
  const stateOptions = def.states.filter((s) => s.code.trim())
  const rows = issuesByRow(version.issues)

  const save = useSaveWorkflowDraft(template.id)
  const discard = useDiscardWorkflowDraft(template.id)
  const publish = usePublishWorkflowVersion(template.id)
  const [confirm, setConfirm] = useState<'discard' | 'publish' | null>(null)
  const current =
    template.current && template.current.id !== version.id
      ? template.current
      : null
  const currentVersion = useWorkflowVersion(
    template.id,
    confirm === 'publish' ? current?.id : undefined,
  )
  const changes =
    currentVersion.data && diffWorkflow(currentVersion.data, version).total

  const publishBlocked = dirty || version.issues.length > 0

  const stateSelect = (
    value: string,
    onChange: (v: string) => void,
    label: string,
  ) => (
    <Select value={value} onValueChange={onChange} disabled={ro}>
      <SelectTrigger className="h-8 w-36" aria-label={label}>
        <SelectValue placeholder="State…" />
      </SelectTrigger>
      <SelectContent>
        {stateOptions.map((s) => (
          <SelectItem key={s.code} value={s.code}>
            {s.code}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-medium">Version {version.versionNo}</h2>
        <DefinitionStatusBadge status={version.status} />
        {dirty && <Badge variant="warning">Unsaved changes</Badge>}
        {isDraft && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirm('discard')}
              disabled={discard.isPending}
            >
              <Trash2 className="size-4" /> Discard draft
            </Button>
            <Button
              variant="outline"
              disabled={!dirty || save.isPending}
              onClick={() =>
                save.mutate({
                  versionId: version.id,
                  version: version.version,
                  definition: def,
                })
              }
            >
              {save.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save draft
            </Button>
            <Button
              onClick={() => setConfirm('publish')}
              disabled={publishBlocked || publish.isPending}
            >
              {publish.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Rocket className="size-4" />
              )}
              Publish
            </Button>
          </div>
        )}
      </div>

      {isDraft ? (
        <div className="space-y-1">
          <IssuesList issues={version.issues} />
          {dirty && (
            <p className="text-xs text-text-3">
              Issues and the test run are from the last save. Save the draft to
              re-check — publishing needs a saved draft with no issues.
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-text-3">
          {version.status === 'published'
            ? 'Published versions never change. Create a new draft to make changes — items already on this version keep it.'
            : 'Retired — nothing new starts on this version; existing work keeps it.'}
        </p>
      )}

      {/* ── States ── */}
      <Panel
        title={`States (${def.states.length})`}
        hint="Exactly one initial state; at least one done and one cancelled terminal state. Codes are lowercase."
        action={
          !ro && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setDef((d) => ({
                  ...d,
                  states: [
                    ...d.states,
                    { code: '', name: '', category: 'active' },
                  ],
                }))
              }
            >
              <Plus className="size-4" /> Add state
            </Button>
          )
        }
      >
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs text-text-3">
            <tr>
              <th className="w-20 px-2 py-2 font-medium">Order</th>
              <th className="px-2 py-2 font-medium">Code</th>
              <th className="px-2 py-2 font-medium">Name</th>
              <th className="px-2 py-2 font-medium">Category</th>
              <th className="w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {def.states.map((s, i) => (
              <Row key={i} issues={rows.states.get(i)} cols={5}>
                <td className="px-2 py-1.5">
                  <div className="flex">
                    <TooltipButton
                      tooltip={`Move ${s.code || 'state'} up`}
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      disabled={ro || i === 0}
                      onClick={() =>
                        setDef((d) => ({ ...d, states: move(d.states, i, -1) }))
                      }
                    >
                      <ArrowUp className="size-3.5" />
                    </TooltipButton>
                    <TooltipButton
                      tooltip={`Move ${s.code || 'state'} down`}
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      disabled={ro || i === def.states.length - 1}
                      onClick={() =>
                        setDef((d) => ({ ...d, states: move(d.states, i, 1) }))
                      }
                    >
                      <ArrowDown className="size-3.5" />
                    </TooltipButton>
                  </div>
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    aria-label={`State ${i + 1} code`}
                    className="h-8 font-mono text-xs"
                    value={s.code}
                    readOnly={ro}
                    onChange={(e) =>
                      setDef((d) =>
                        updateState(d, i, {
                          code: e.target.value.toLowerCase(),
                        }),
                      )
                    }
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    aria-label={`State ${i + 1} name`}
                    className="h-8"
                    value={s.name}
                    readOnly={ro}
                    onChange={(e) =>
                      setDef((d) => updateState(d, i, { name: e.target.value }))
                    }
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Select
                    value={s.category}
                    disabled={ro}
                    onValueChange={(v) =>
                      setDef((d) =>
                        updateState(d, i, { category: v as StateCategory }),
                      )
                    }
                  >
                    <SelectTrigger
                      className="h-8 w-32"
                      aria-label={`State ${i + 1} category`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATE_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-2 py-1.5">
                  {!ro && (
                    <TooltipButton
                      tooltip={`Remove state ${s.code || i + 1}`}
                      variant="ghost"
                      size="icon"
                      className="size-7 text-danger"
                      onClick={() => setDef((d) => removeState(d, i))}
                    >
                      <X className="size-3.5" />
                    </TooltipButton>
                  )}
                </td>
              </Row>
            ))}
          </tbody>
        </table>
      </Panel>

      {/* ── Transitions ── */}
      <Panel
        title={`Transitions (${def.transitions.length})`}
        hint={`One action per state. Order-status edges the engine computes use action "${DERIVED_ACTION}" and the system side only. Empty roles = any role of an allowed side.`}
        action={
          !ro && (
            <Button
              size="sm"
              variant="outline"
              disabled={stateOptions.length < 2}
              onClick={() =>
                setDef((d) => ({
                  ...d,
                  transitions: [
                    ...d.transitions,
                    {
                      from: '',
                      to: '',
                      action: '',
                      allowedSides: [],
                      allowedRoles: [],
                      requiredFields: [],
                      requiresReason: false,
                      effects: [],
                    },
                  ],
                }))
              }
            >
              <Plus className="size-4" /> Add transition
            </Button>
          )
        }
      >
        <table className="w-full min-w-[1180px] text-sm">
          <thead className="text-left text-xs text-text-3">
            <tr>
              <th className="px-2 py-2 font-medium">From</th>
              <th className="px-2 py-2 font-medium">Action</th>
              <th className="px-2 py-2 font-medium">To</th>
              <th className="px-2 py-2 font-medium">Sides</th>
              <th className="px-2 py-2 font-medium">Roles</th>
              <th className="px-2 py-2 font-medium">Required input</th>
              <th className="px-2 py-2 font-medium">Reason</th>
              <th className="px-2 py-2 font-medium">Effects</th>
              <th className="w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {def.transitions.map((t, i) => {
              const set = (patch: Parameters<typeof updateTransition>[2]) =>
                setDef((d) => updateTransition(d, i, patch))
              const derived = t.action.trim() === DERIVED_ACTION
              const label = `Transition ${i + 1}`
              return (
                <Row key={i} issues={rows.transitions.get(i)} cols={9}>
                  <td className="px-2 py-1.5">
                    {stateSelect(
                      t.from,
                      (v) => set({ from: v }),
                      `${label} from`,
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      aria-label={`${label} action`}
                      className="h-8 w-32 font-mono text-xs"
                      value={t.action}
                      readOnly={ro}
                      onChange={(e) =>
                        set({ action: e.target.value.toLowerCase() })
                      }
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    {stateSelect(t.to, (v) => set({ to: v }), `${label} to`)}
                  </td>
                  <td className="px-2 py-1.5">
                    <MultiSelect
                      aria-label={`${label} sides`}
                      className="w-40"
                      options={SIDE_OPTIONS}
                      value={t.allowedSides}
                      disabled={ro || derived}
                      onChange={(v) =>
                        set({ allowedSides: v as TransitionSide[] })
                      }
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <MultiSelect
                      aria-label={`${label} roles`}
                      className="w-44"
                      placeholder="Any role"
                      options={ROLE_OPTIONS}
                      value={t.allowedRoles ?? []}
                      disabled={ro || derived}
                      onChange={(v) => set({ allowedRoles: v })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <MultiSelect
                      aria-label={`${label} required input`}
                      className="w-44"
                      placeholder="None"
                      creatable
                      options={(t.requiredFields ?? []).map((f) => ({
                        value: f,
                        label: f,
                      }))}
                      value={t.requiredFields ?? []}
                      disabled={ro}
                      onChange={(v) => set({ requiredFields: v })}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <Checkbox
                      aria-label={`${label} requires a reason`}
                      checked={t.requiresReason ?? false}
                      disabled={ro}
                      onCheckedChange={(c) =>
                        set({ requiresReason: c === true })
                      }
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <MultiSelect
                      aria-label={`${label} effects`}
                      className="w-52"
                      placeholder="None"
                      options={effectOptions}
                      value={(t.effects ?? []).map((e) => e.code)}
                      disabled={ro}
                      onChange={(codes) =>
                        set({
                          // Keep params of effects that stay picked.
                          effects: codes.map(
                            (code) =>
                              (t.effects ?? []).find(
                                (e) => e.code === code,
                              ) ?? {
                                code,
                              },
                          ),
                        })
                      }
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    {!ro && (
                      <TooltipButton
                        tooltip={`Remove ${label.toLowerCase()}`}
                        variant="ghost"
                        size="icon"
                        className="size-7 text-danger"
                        onClick={() =>
                          setDef((d) => ({
                            ...d,
                            transitions: d.transitions.filter(
                              (_, n) => n !== i,
                            ),
                          }))
                        }
                      >
                        <X className="size-3.5" />
                      </TooltipButton>
                    )}
                  </td>
                </Row>
              )
            })}
          </tbody>
        </table>
      </Panel>

      <SimulationPanel runs={version.simulation} stale={dirty} />

      <ConfirmDialog
        open={confirm === 'discard'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Discard draft v${version.versionNo}?`}
        description="The draft and all its changes are deleted. Published versions are not affected."
        confirmLabel="Discard draft"
        destructive
        isLoading={discard.isPending}
        onConfirm={() =>
          discard.mutate(version.id, {
            onSuccess: () => {
              setConfirm(null)
              onDiscarded()
            },
          })
        }
      />
      <ConfirmDialog
        open={confirm === 'publish'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Publish version ${version.versionNo}?`}
        description={
          current
            ? `New work will run on v${version.versionNo}; v${current.versionNo} is retired and anything already on it keeps it.${
                changes === undefined
                  ? ''
                  : ` ${changes} change${changes === 1 ? '' : 's'} vs v${current.versionNo}.`
              }`
            : `New work will run on v${version.versionNo}. Published versions can never be edited.`
        }
        confirmLabel="Publish"
        isLoading={publish.isPending}
        onConfirm={() =>
          publish.mutate(
            { versionId: version.id, version: version.version },
            { onSuccess: () => setConfirm(null) },
          )
        }
      />
    </div>
  )
}

function Panel({
  title,
  hint,
  action,
  children,
}: {
  title: string
  hint: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-text-3">{hint}</p>
        </div>
        {action}
      </div>
      <div className="overflow-x-auto px-2 py-1">{children}</div>
    </section>
  )
}

/** A table row, flagged with the saved draft's issues for that row. */
function Row({
  issues,
  cols,
  children,
}: {
  issues?: Issue[]
  cols: number
  children: ReactNode
}) {
  return (
    <>
      <tr
        className={cn(
          'border-t border-border transition-colors hover:bg-accent/20',
          issues?.length && 'bg-amber-soft/40',
        )}
      >
        {children}
      </tr>
      {issues?.length ? (
        <tr className="bg-amber-soft/40">
          <td colSpan={cols} className="px-3 pb-2 text-xs text-amber">
            {issues.map((i) => i.message).join(' · ')}
          </td>
        </tr>
      ) : null}
    </>
  )
}
