import { useState } from 'react'
import { Loader2, Pencil, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/forms/NumberInput'
import {
  EmptyState,
  ErrorState,
  FieldWrapper,
  FormSelect,
  FormSheet,
  LoadingSkeleton,
} from '@/components/shared'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { fieldError } from '@/features/queue'
import { useCategoryForm } from '../hooks/useCategoryForm'
import {
  useAllServiceCategories,
  useCatalogSpecialties,
  useSetCategoryActive,
} from '../hooks/usePlatformCatalog'
import type { ServiceCategory } from '../types'
import { ActiveSwitch } from './ActiveSwitch'

/** Add or edit one category, shown at the top of the manager. */
function CategoryForm({
  category,
  specialties,
  onDone,
}: {
  category: ServiceCategory | null
  specialties: { id: string; name: string }[]
  onDone: () => void
}) {
  const form = useCategoryForm({
    open: true,
    category,
    defaultSpecialtyId: specialties[0]?.id ?? '',
    onDone,
  })
  const editing = !!category
  return (
    <form
      className="space-y-3 rounded-lg border border-border bg-muted/30 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
    >
      <p className="text-sm font-medium">
        {editing ? `Edit ${category.name}` : 'New category'}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <form.Field name="specialtyId">
          {(f) => (
            <FormSelect
              label="Specialty"
              required
              disabled={editing}
              value={f.state.value}
              onValueChange={f.handleChange}
              options={specialties.map((s) => ({ value: s.id, label: s.name }))}
              error={fieldError(f)}
            />
          )}
        </form.Field>
        <form.Field name="code">
          {(f) => (
            <FieldWrapper
              label="Code"
              htmlFor="cat-code"
              required
              error={fieldError(f)}
              hint={editing ? 'The code never changes.' : 'e.g. CROWNS'}
            >
              <Input
                id="cat-code"
                value={f.state.value}
                disabled={editing}
                onChange={(e) => f.handleChange(e.target.value.toUpperCase())}
                onBlur={f.handleBlur}
              />
            </FieldWrapper>
          )}
        </form.Field>
        <form.Field name="name">
          {(f) => (
            <FieldWrapper
              label="Name"
              htmlFor="cat-name"
              required
              error={fieldError(f)}
            >
              <Input
                id="cat-name"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
              />
            </FieldWrapper>
          )}
        </form.Field>
        <form.Field name="sortOrder">
          {(f) => (
            <FieldWrapper
              label="Order"
              htmlFor="cat-order"
              error={fieldError(f)}
            >
              <NumberInput
                id="cat-order"
                mode="integer"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
              />
            </FieldWrapper>
          )}
        </form.Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <form.Subscribe
          selector={(s) => [s.canSubmit, s.isSubmitting] as const}
        >
          {([canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              size="sm"
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {editing ? 'Save' : 'Add category'}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  )
}

/**
 * Platform service categories (super admins): what lab services are grouped
 * under on every clinic's catalog. Archiving hides a category from new
 * services; its services keep it.
 */
export function CategoriesSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const categories = useAllServiceCategories(open)
  const specialties = useCatalogSpecialties(open)
  const setActive = useSetCategoryActive()
  // undefined = no form; null = adding; a category = editing it.
  const [editing, setEditing] = useState<ServiceCategory | null | undefined>()
  const nameOf = new Map((specialties.data ?? []).map((s) => [s.id, s.name]))
  const pendingId = setActive.isPending ? setActive.variables.category.id : null

  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => {
        if (!o) setEditing(undefined)
        onOpenChange(o)
      }}
      title="Service categories"
      description="Groups for lab services across every lab and clinic."
      footer={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      }
    >
      <div className="space-y-4">
        {editing === undefined ? (
          <Button
            size="sm"
            disabled={!specialties.data?.length}
            onClick={() => setEditing(null)}
          >
            <Plus className="size-3.5" /> Add category
          </Button>
        ) : (
          <CategoryForm
            key={editing?.id ?? 'new'}
            category={editing}
            specialties={specialties.data ?? []}
            onDone={() => setEditing(undefined)}
          />
        )}

        {categories.isLoading ? (
          <LoadingSkeleton variant="table" />
        ) : categories.isError ? (
          <ErrorState onRetry={() => void categories.refetch()} />
        ) : !categories.data?.length ? (
          <EmptyState
            title="No categories yet"
            description="Add the first category, e.g. Crowns & bridges."
          />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {categories.data.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 px-3 py-2 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {c.name}
                    {!c.isActive && (
                      <Badge variant="muted" className="ml-2">
                        Archived
                      </Badge>
                    )}
                  </p>
                  <p className="text-xs text-text-3">
                    {c.code} · {nameOf.get(c.specialtyId) ?? 'Specialty'} ·{' '}
                    {c.serviceCount} service{c.serviceCount === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <TooltipButton
                    tooltip={`Edit ${c.name}`}
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => setEditing(c)}
                  >
                    <Pencil className="size-4" />
                  </TooltipButton>
                  <ActiveSwitch
                    checked={c.isActive}
                    disabled={pendingId === c.id}
                    label={`${c.name} is offered`}
                    onTooltip="Archive this category"
                    offTooltip="Offer this category again"
                    onChange={(isActive) =>
                      setActive.mutate({ category: c, isActive })
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </FormSheet>
  )
}
