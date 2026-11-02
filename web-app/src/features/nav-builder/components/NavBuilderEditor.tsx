import { useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type {
  CollisionDetection,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Folder, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import {
  MAX_SECTIONS,
  TRAY,
  addSection,
  findContainer,
  moveNode,
  moveSection,
} from '../lib/builder-state'
import type { BuilderState } from '../lib/builder-state'
import type { BuilderUpdate } from '../hooks/useNavBuilder'
import {
  DropList,
  ItemRowContent,
  SortableItem,
  SortableSection,
} from './BuilderRows'

type DragType = 'section' | 'group' | 'item' | 'container'

const typeOf = (data: { current?: Record<string, unknown> } | undefined) =>
  data?.current?.type as DragType | undefined

/**
 * Sections only collide with sections. Links and groups go to the innermost
 * thing under the pointer (a row, else the smallest list), so a link dropped
 * on a group's list goes into the group, and one dropped on the group's
 * header goes next to it.
 */
const collision: CollisionDetection = (args) => {
  const activeType = typeOf(args.active.data)
  const droppableContainers = args.droppableContainers.filter((c) => {
    if (c.id === args.active.id) return false
    const t = typeOf(c.data)
    return activeType === 'section' ? t === 'section' : t !== 'section'
  })
  const scoped = { ...args, droppableContainers }
  if (activeType === 'section') return closestCenter(scoped)
  const within = pointerWithin(scoped)
  if (within.length) {
    const area = (id: string | number) => {
      const r = args.droppableRects.get(id)
      return r ? r.width * r.height : Infinity
    }
    return [...within].sort((a, b) => area(a.id) - area(b.id)).slice(0, 1)
  }
  return closestCenter(scoped)
}

/** Drag-and-drop editor of sections, groups and links. */
export function NavBuilderEditor({
  state,
  update,
}: {
  state: BuilderState
  update: BuilderUpdate
}) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const onDragStart = ({ active }: DragStartEvent) => {
    lastMove.current = null
    setActiveId(String(active.id))
  }

  // A move into another list changes the layout under the pointer, which can
  // make the row "collide" with the list it just left and bounce straight
  // back — over and over until React gives up ("Maximum update depth").
  // So: at most one cross-list move per frame, and never straight back.
  const lastMove = useRef<{ from: string; to: string; at: number } | null>(null)
  const moving = useRef(false)

  // Across lists: move as soon as the pointer enters another list.
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || typeOf(active.data) === 'section' || moving.current) return
    const id = String(active.id)
    const overId = String(over.id)
    const from = findContainer(state, id)
    const to = findContainer(state, overId)
    if (!from || !to || from === to) return
    const prev = lastMove.current
    if (
      prev &&
      prev.from === to &&
      prev.to === from &&
      Date.now() - prev.at < 250
    ) {
      return
    }
    lastMove.current = { from, to, at: Date.now() }
    moving.current = true
    requestAnimationFrame(() => {
      moving.current = false
    })
    update((s) => {
      const index = s.containers[to].indexOf(overId)
      return moveNode(s, id, to, index >= 0 ? index : s.containers[to].length)
    })
  }

  // Within a list: reorder on drop.
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    if (!over || active.id === over.id) return
    const id = String(active.id)
    const overId = String(over.id)
    if (typeOf(active.data) === 'section') {
      update((s) => moveSection(s, id, s.sections.indexOf(overId)))
      return
    }
    update((s) => {
      const from = findContainer(s, id)
      if (!from || from !== findContainer(s, overId)) return s
      const index = s.containers[from].indexOf(overId)
      return index >= 0 ? moveNode(s, id, from, index) : s
    })
  }

  const active = activeId ? state.nodes[activeId] : undefined

  return (
    <TooltipProvider delayDuration={300}>
      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="space-y-4">
          <SortableContext
            items={state.sections}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {state.sections.map((id) => (
                <SortableSection
                  key={id}
                  id={id}
                  state={state}
                  update={update}
                />
              ))}
            </div>
          </SortableContext>

          <Button
            type="button"
            variant="outline"
            className="w-full border-dashed"
            disabled={state.sections.length >= MAX_SECTIONS}
            onClick={() => update((s) => addSection(s))}
          >
            <Plus className="size-4" />
            {state.sections.length >= MAX_SECTIONS
              ? `Up to ${MAX_SECTIONS} sections`
              : 'Add section'}
          </Button>

          <section
            aria-label="Not placed"
            className="rounded-xl border border-dashed border-border bg-panel/40 p-3"
          >
            <h3 className="text-sm font-medium">Not placed</h3>
            <p className="mb-2 text-xs text-muted-foreground">
              Pages not in any section appear under “More” at the end of the
              sidebar. Drag them into a section to place them.
            </p>
            <DropList
              id={TRAY}
              items={state.containers[TRAY]}
              empty="Every page is placed"
            >
              {state.containers[TRAY].map((id) => (
                <SortableItem key={id} id={id} state={state} update={update} />
              ))}
            </DropList>
          </section>
        </div>

        <DragOverlay>
          {active?.kind === 'item' ? (
            <ItemRowContent
              node={active}
              hidden={state.hidden.includes(active.key)}
            />
          ) : active ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium shadow-lg">
              <Folder className="size-4 text-text-2" />
              {active.label || 'Untitled section'}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </TooltipProvider>
  )
}
