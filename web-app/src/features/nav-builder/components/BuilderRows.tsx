import type { ElementType, ReactNode } from 'react'
import { useDroppable } from '@dnd-kit/core'
import type { DraggableSyntheticListeners } from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Folder, FolderPlus, GripVertical, Trash2, Ungroup } from 'lucide-react'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { NAV_ICONS, NAV_ITEMS } from '@/features/access'
import type { NavItemDef } from '@/features/access'
import { cn } from '@/lib/utils'
import {
  addGroup,
  containerId,
  removeGroup,
  removeSection,
  renameNode,
  toggleHidden,
} from '../lib/builder-state'
import type { BuilderNode, BuilderState } from '../lib/builder-state'
import type { BuilderUpdate } from '../hooks/useNavBuilder'
import { InlineLabel } from './InlineLabel'

const registry: Record<string, NavItemDef | undefined> = NAV_ITEMS
const icons: Record<string, ElementType | undefined> = NAV_ICONS

/** Who can see a page — a hint only; the sidebar checks it per user. */
function audienceOf(def: NavItemDef): string {
  if (def.superAdminOnly) return 'Super admin only'
  if (def.ownerOrSuperAdmin) return 'Owner only'
  if (def.labMember) return 'Lab members'
  if (!def.can) return 'Everyone'
  return Array.isArray(def.can) ? def.can.join(' or ') : String(def.can)
}

interface RowProps {
  id: string
  state: BuilderState
  update: BuilderUpdate
}

/** dnd-kit positions rows with a transform; it can only be set inline. */
function useSortableRow(id: string, type: 'section' | 'group' | 'item') {
  const sortable = useSortable({ id, data: { type } })
  return {
    ...sortable,
    style: {
      transform: CSS.Translate.toString(sortable.transform),
      transition: sortable.transition,
    },
  }
}

function DragHandle({
  label,
  listeners,
  attributes,
  setRef,
}: {
  label: string
  listeners: DraggableSyntheticListeners
  attributes: ReturnType<typeof useSortable>['attributes']
  setRef: (el: HTMLElement | null) => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          ref={setRef}
          {...attributes}
          {...listeners}
          aria-label={label}
          className="flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-panel active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="text-xs">{label}</TooltipContent>
    </Tooltip>
  )
}

/** Droppable list of children (section entries, group links, the tray). */
export function DropList({
  id,
  items,
  empty,
  children,
  className,
}: {
  id: string
  items: string[]
  empty: string
  children: ReactNode
  className?: string
}) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { type: 'container' },
  })
  return (
    <SortableContext items={items} strategy={verticalListSortingStrategy}>
      <div
        ref={setNodeRef}
        className={cn(
          'min-h-10 space-y-1 rounded-lg transition-colors',
          isOver && 'bg-primary/5',
          className,
        )}
      >
        {children}
        {items.length === 0 && (
          <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-center text-xs text-muted-foreground">
            {empty}
          </p>
        )}
      </div>
    </SortableContext>
  )
}

/** Static look of a link row (also used in the drag overlay). */
export function ItemRowContent({
  node,
  hidden,
  handle,
  actions,
  label,
}: {
  node: Extract<BuilderNode, { kind: 'item' }>
  hidden: boolean
  handle?: ReactNode
  actions?: ReactNode
  label?: ReactNode
}) {
  const def = registry[node.key]
  if (!def) return null
  const Icon = def.icon
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm',
        hidden && 'opacity-60',
      )}
    >
      {handle}
      <Icon className="size-4 shrink-0 text-text-2" />
      {label ?? <span className="truncate">{node.label ?? def.label}</span>}
      {node.label && (
        <span className="hidden shrink-0 text-xs text-muted-foreground md:inline">
          was {def.label}
        </span>
      )}
      {hidden && (
        <Badge variant="secondary" className="shrink-0">
          Hidden
        </Badge>
      )}
      <span className="ml-auto hidden max-w-40 shrink truncate text-xs text-muted-foreground lg:inline">
        {audienceOf(def)}
      </span>
      {actions}
    </div>
  )
}

export function SortableItem({ id, state, update }: RowProps) {
  const row = useSortableRow(id, 'item')
  const node = state.nodes[id] as Extract<BuilderNode, { kind: 'item' }>
  const def = registry[node.key]
  if (!def) return null
  const hidden = state.hidden.includes(node.key)
  const name = node.label ?? def.label
  return (
    <div
      ref={row.setNodeRef}
      style={row.style}
      className={cn(row.isDragging && 'opacity-40')}
    >
      <ItemRowContent
        node={node}
        hidden={hidden}
        handle={
          <DragHandle
            label={`Drag ${name}`}
            listeners={row.listeners}
            attributes={row.attributes}
            setRef={row.setActivatorNodeRef}
          />
        }
        label={
          <InlineLabel
            value={node.label ?? ''}
            placeholder={def.label}
            renameLabel={`Rename ${name}`}
            onCommit={(label) => update((s) => renameNode(s, id, label))}
          />
        }
        actions={
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex shrink-0">
                <Switch
                  checked={!hidden}
                  aria-label={hidden ? `Show ${name}` : `Hide ${name}`}
                  onCheckedChange={() =>
                    update((s) => toggleHidden(s, node.key))
                  }
                />
              </span>
            </TooltipTrigger>
            <TooltipContent className="text-xs">
              {hidden ? 'Hidden — click to show' : 'Shown — click to hide'}
            </TooltipContent>
          </Tooltip>
        }
      />
    </div>
  )
}

export function SortableGroup({ id, state, update }: RowProps) {
  const row = useSortableRow(id, 'group')
  const node = state.nodes[id] as Extract<BuilderNode, { kind: 'group' }>
  const Icon = (node.icon ? icons[node.icon] : undefined) ?? Folder
  const inner = containerId(id)
  return (
    <div
      ref={row.setNodeRef}
      style={row.style}
      className={cn(
        'rounded-lg border border-border bg-panel/50 p-1.5',
        row.isDragging && 'opacity-40',
      )}
    >
      <div className="flex items-center gap-2 px-0.5 pb-1.5 text-sm font-medium">
        <DragHandle
          label={`Drag group ${node.label}`}
          listeners={row.listeners}
          attributes={row.attributes}
          setRef={row.setActivatorNodeRef}
        />
        <Icon className="size-4 shrink-0 text-text-2" />
        <InlineLabel
          value={node.label}
          placeholder="Group"
          renameLabel={`Rename group ${node.label}`}
          onCommit={(label) => update((s) => renameNode(s, id, label))}
        />
        <TooltipButton
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground"
          tooltip={`Ungroup ${node.label} (its pages stay in the section)`}
          onClick={() => update((s) => removeGroup(s, id))}
        >
          <Ungroup className="size-4" />
        </TooltipButton>
      </div>
      <DropList
        id={inner}
        items={state.containers[inner]}
        empty="Drop pages here"
        className="ml-4"
      >
        {state.containers[inner].map((child) => (
          <SortableItem key={child} id={child} state={state} update={update} />
        ))}
      </DropList>
    </div>
  )
}

export function SortableSection({ id, state, update }: RowProps) {
  const row = useSortableRow(id, 'section')
  const node = state.nodes[id] as Extract<BuilderNode, { kind: 'section' }>
  const inner = containerId(id)
  const title = node.label || 'Untitled section'
  return (
    <section
      ref={row.setNodeRef}
      style={row.style}
      aria-label={title}
      className={cn(
        'rounded-xl border border-border bg-surface p-3 shadow-sm',
        row.isDragging && 'opacity-40',
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <DragHandle
          label={`Drag section ${title}`}
          listeners={row.listeners}
          attributes={row.attributes}
          setRef={row.setActivatorNodeRef}
        />
        <InlineLabel
          value={node.label}
          placeholder="No title (pages only)"
          renameLabel={`Rename section ${title}`}
          onCommit={(label) => update((s) => renameNode(s, id, label))}
          className="text-xs font-bold uppercase tracking-wider text-text-2"
        />
        <TooltipButton
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground"
          tooltip={`Add a group to ${title}`}
          onClick={() => update((s) => addGroup(s, id))}
        >
          <FolderPlus className="size-4" />
        </TooltipButton>
        <TooltipButton
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
          tooltip={`Remove section ${title} (its pages move to Not placed)`}
          onClick={() => update((s) => removeSection(s, id))}
        >
          <Trash2 className="size-4" />
        </TooltipButton>
      </div>
      <DropList
        id={inner}
        items={state.containers[inner]}
        empty="Drop pages here"
      >
        {state.containers[inner].map((child) =>
          state.nodes[child].kind === 'group' ? (
            <SortableGroup
              key={child}
              id={child}
              state={state}
              update={update}
            />
          ) : (
            <SortableItem
              key={child}
              id={child}
              state={state}
              update={update}
            />
          ),
        )}
      </DropList>
    </section>
  )
}
