import { useState } from 'react'
import { useBlocker } from '@tanstack/react-router'
import { Loader2, RotateCcw, Save } from 'lucide-react'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingSkeleton } from '@/components/feedback/LoadingSkeleton'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { NAV_ITEMS } from '@/features/access'
import type { NavItemDef, NavLayout } from '@/features/access'
import { useAuthStore } from '@/store/useAuthStore'
import { NavBuilderEditor } from '../components/NavBuilderEditor'
import { NavPreview } from '../components/NavPreview'
import { useNavBuilder } from '../hooks/useNavBuilder'
import {
  useClinicNavLayout,
  useResetNavLayout,
  useSaveNavLayout,
} from '../hooks/useNavLayoutQueries'
import { ARRANGEABLE_KEYS, setHomeRoute } from '../lib/builder-state'

const NO_HOME = '__dashboard__'
const registry: Record<string, NavItemDef | undefined> = NAV_ITEMS

/** Pages a clinic may pick as its home page (not platform / lab-side ones). */
const HOME_OPTIONS = ARRANGEABLE_KEYS.map((key) => registry[key]!)
  .filter((d) => !d.superAdminOnly && !d.labMember && d.href !== '/dashboard')
  .map((d) => ({ href: d.href, label: d.label }))

/** `/settings/sidebar` — the clinic's sidebar: rename, hide, reorder. */
export function NavBuilderPage() {
  const orgId = useAuthStore((s) => s.activeOrganizationId)
  const query = useClinicNavLayout(orgId)
  const save = useSaveNavLayout(orgId)
  const reset = useResetNavLayout(orgId)
  const [confirmReset, setConfirmReset] = useState(false)

  return (
    <DashboardLayout
      title="Sidebar"
      subtitle="Rename, hide and reorder the pages in your clinic's sidebar. Each person still sees only the pages they have access to."
      backTo="/settings"
      backLabel="Back to settings"
    >
      {query.isPending ? (
        <LoadingSkeleton variant="detail" />
      ) : query.isError ? (
        <ErrorState
          title="Couldn't load the sidebar layout"
          onRetry={() => void query.refetch()}
        />
      ) : (
        <NavBuilderForm
          saved={query.data?.layout ?? null}
          isCustom={!!query.data}
          isSaving={save.isPending}
          isResetting={reset.isPending}
          onSave={(layout) => save.mutateAsync(layout)}
          onReset={() => setConfirmReset(true)}
        />
      )}

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset the sidebar to default?"
        description="Your sections, renames, hidden pages and clinic home page are removed, and everyone gets the standard sidebar again."
        confirmLabel="Reset to default"
        destructive
        isLoading={reset.isPending}
        onConfirm={() =>
          reset.mutate(undefined, { onSuccess: () => setConfirmReset(false) })
        }
      />
    </DashboardLayout>
  )
}

function NavBuilderForm({
  saved,
  isCustom,
  isSaving,
  isResetting,
  onSave,
  onReset,
}: {
  saved: NavLayout | null
  isCustom: boolean
  isSaving: boolean
  isResetting: boolean
  onSave: (layout: NavLayout) => Promise<unknown>
  onReset: () => void
}) {
  const builder = useNavBuilder(saved)
  const blocker = useBlocker({
    shouldBlockFn: () => builder.isDirty && !isSaving,
    enableBeforeUnload: () => builder.isDirty,
    withResolver: true,
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {builder.isDirty
            ? 'You have unsaved changes.'
            : isCustom
              ? 'Your clinic uses a custom sidebar.'
              : 'Your clinic uses the standard sidebar.'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {builder.isDirty && (
            <Button
              type="button"
              variant="ghost"
              disabled={isSaving}
              onClick={builder.discard}
            >
              Discard changes
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={!isCustom || isResetting || isSaving}
            onClick={onReset}
          >
            {isResetting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RotateCcw className="size-4" />
            )}
            Reset to default
          </Button>
          <Button
            type="button"
            disabled={!builder.isDirty || isSaving}
            onClick={() => void onSave(builder.layout).catch(() => {})}
          >
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <Label htmlFor="nav-home" className="text-sm font-medium">
              Clinic home page
            </Label>
            <p className="mb-2 text-xs text-muted-foreground">
              Where staff land after signing in. A role&apos;s own home page
              wins; people who can&apos;t open this page land on the Dashboard.
            </p>
            <Select
              value={builder.state.homeRoute ?? NO_HOME}
              onValueChange={(v) =>
                builder.update((s) => setHomeRoute(s, v === NO_HOME ? null : v))
              }
            >
              <SelectTrigger id="nav-home" className="w-full sm:w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_HOME}>Dashboard (default)</SelectItem>
                {HOME_OPTIONS.map((o) => (
                  <SelectItem key={o.href} value={o.href}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <NavBuilderEditor state={builder.state} update={builder.update} />
        </div>

        <aside className="space-y-2 lg:sticky lg:top-6 lg:self-start">
          <h2 className="text-sm font-medium">Preview</h2>
          <p className="text-xs text-muted-foreground">
            The sidebar as you would see it. Other roles see only their pages.
          </p>
          <NavPreview layout={builder.layout} />
        </aside>
      </div>

      <ConfirmDialog
        open={blocker.status === 'blocked'}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.()
        }}
        title="Leave without saving?"
        description="Your sidebar changes haven't been saved and will be lost."
        confirmLabel="Leave"
        destructive
        onConfirm={() => blocker.proceed?.()}
      />
    </div>
  )
}
