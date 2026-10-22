import { FOOTER_NAV_KEYS, NAV_ITEMS } from '@/features/access'
import type {
  NavItemDef,
  NavLayout,
  NavLayoutGroup,
  NavLayoutItem,
  NavLayoutSection,
} from '@/features/access'

/**
 * Editable form of a `NavLayout` for the sidebar builder. Every node has a
 * stable id so drag-and-drop can address it:
 *
 * - sections `sec:N`, their entries live in container `in:sec:N`
 * - groups `grp:N` (entries of a section), their links in `in:grp:N`
 * - links `itm:<nav key>` (keys are unique in a layout)
 * - `tray`: registry pages the layout doesn't place (the sidebar shows them
 *   under "More"); never saved
 */
export type BuilderNode =
  | { kind: 'section'; label: string; group: boolean; icon?: string }
  | { kind: 'group'; label: string; icon?: string }
  | { kind: 'item'; key: string; label?: string; pinned?: boolean }

export interface BuilderState {
  sections: string[]
  containers: Record<string, string[]>
  nodes: Record<string, BuilderNode>
  hidden: string[]
  homeRoute: string | null
  seq: number
}

export const TRAY = 'tray'
export const MAX_SECTIONS = 20
export const MAX_LABEL = 40

export const containerId = (nodeId: string) => `in:${nodeId}`
export const itemId = (key: string) => `itm:${key}`

const registry: Record<string, NavItemDef | undefined> = NAV_ITEMS
const footer = new Set<string>(FOOTER_NAV_KEYS)

/** Registry keys the builder arranges (footer items stay pinned). */
export const ARRANGEABLE_KEYS = Object.keys(NAV_ITEMS).filter(
  (k) => !footer.has(k),
)

// Server data: only a literal `group: true` makes a group.
const isGroupEntry = (e: NavLayoutItem | NavLayoutGroup): e is NavLayoutGroup =>
  (e as { group?: unknown }).group === true

const listOf = <T>(v: T[] | undefined | null): T[] =>
  Array.isArray(v) ? v.filter((x) => x != null && typeof x === 'object') : []

export function fromLayout(layout: NavLayout): BuilderState {
  const state: BuilderState = {
    sections: [],
    containers: { [TRAY]: [] },
    nodes: {},
    hidden: [],
    homeRoute: layout.homeRoute ?? null,
    seq: 0,
  }
  const placed = new Set<string>(footer)
  const nextId = (prefix: string) => `${prefix}:${++state.seq}`

  // Unknown, footer and repeated keys are dropped (the sidebar ignores them).
  const addItem = (container: string, item: NavLayoutItem) => {
    if (typeof item.key !== 'string' || !registry[item.key]) return
    if (placed.has(item.key)) return
    placed.add(item.key)
    const id = itemId(item.key)
    state.nodes[id] = {
      kind: 'item',
      key: item.key,
      ...(item.label?.trim() ? { label: item.label.trim() } : {}),
      ...(item.pinned ? { pinned: true } : {}),
    }
    state.containers[container].push(id)
  }

  for (const section of listOf<NavLayoutSection>(layout.sections)) {
    const id = nextId('sec')
    state.sections.push(id)
    state.nodes[id] = {
      kind: 'section',
      label: section.label ?? '',
      group: !!section.group,
      ...(section.icon ? { icon: section.icon } : {}),
    }
    const inner = containerId(id)
    state.containers[inner] = []
    for (const entry of listOf(section.items)) {
      if (isGroupEntry(entry)) {
        const gid = nextId('grp')
        state.nodes[gid] = {
          kind: 'group',
          label: entry.label || 'Group',
          ...(entry.icon ? { icon: entry.icon } : {}),
        }
        state.containers[containerId(gid)] = []
        state.containers[inner].push(gid)
        for (const child of listOf(entry.items)) {
          addItem(containerId(gid), child)
        }
      } else {
        addItem(inner, entry)
      }
    }
  }

  for (const key of ARRANGEABLE_KEYS) {
    if (!placed.has(key)) addItem(TRAY, { key })
  }
  const hidden = Array.isArray(layout.hidden) ? layout.hidden : []
  state.hidden = hidden.filter(
    (k, i) => typeof k === 'string' && !!registry[k] && hidden.indexOf(k) === i,
  )
  return state
}

function itemJson(state: BuilderState, id: string): NavLayoutItem {
  const node = state.nodes[id] as Extract<BuilderNode, { kind: 'item' }>
  return {
    key: node.key,
    ...(node.label ? { label: node.label } : {}),
    ...(node.pinned ? { pinned: true } : {}),
  }
}

/** The layout to save — the tray is not part of it. */
export function toLayout(state: BuilderState): NavLayout {
  const sections = state.sections.map((sid): NavLayoutSection => {
    const node = state.nodes[sid] as Extract<BuilderNode, { kind: 'section' }>
    return {
      ...(node.label ? { label: node.label } : {}),
      ...(node.group ? { group: true } : {}),
      ...(node.icon ? { icon: node.icon } : {}),
      items: state.containers[containerId(sid)].map((cid) => {
        const child = state.nodes[cid]
        if (child.kind !== 'group') return itemJson(state, cid)
        return {
          label: child.label,
          group: true as const,
          ...(child.icon ? { icon: child.icon } : {}),
          items: state.containers[containerId(cid)].map((id) =>
            itemJson(state, id),
          ),
        }
      }),
    }
  })
  return {
    sections,
    hidden: [...state.hidden],
    ...(state.homeRoute ? { homeRoute: state.homeRoute } : {}),
  }
}

/** The container holding `id`; a container id maps to itself. */
export function findContainer(state: BuilderState, id: string): string | null {
  if (id in state.containers) return id
  // Ids come from drag events: they may be container ids, not nodes.
  const node = state.nodes[id] as BuilderNode | undefined
  if (node?.kind === 'section') return containerId(id)
  for (const [cid, children] of Object.entries(state.containers)) {
    if (children.includes(id)) return cid
  }
  return null
}

/** Links go anywhere; groups only into sections (no nesting); sections nowhere. */
export function canDrop(
  state: BuilderState,
  nodeId: string,
  container: string,
): boolean {
  const node = state.nodes[nodeId] as BuilderNode | undefined
  if (!node || !(container in state.containers)) return false
  if (node.kind === 'item') return true
  if (node.kind === 'group') return container.startsWith('in:sec:')
  return false
}

/** Move a link or group to `index` of `container` (clamped). */
export function moveNode(
  state: BuilderState,
  nodeId: string,
  container: string,
  index: number,
): BuilderState {
  const from = findContainer(state, nodeId)
  if (!from || !canDrop(state, nodeId, container)) return state
  const containers = { ...state.containers }
  containers[from] = containers[from].filter((id) => id !== nodeId)
  const target = [...containers[container]]
  target.splice(Math.max(0, Math.min(index, target.length)), 0, nodeId)
  containers[container] = target
  return { ...state, containers }
}

export function moveSection(
  state: BuilderState,
  sectionId: string,
  index: number,
): BuilderState {
  if (!state.sections.includes(sectionId)) return state
  const sections = state.sections.filter((id) => id !== sectionId)
  sections.splice(Math.max(0, Math.min(index, sections.length)), 0, sectionId)
  return { ...state, sections }
}

/**
 * Rename a node. A link renamed to '' or to its registry name goes back to
 * the default label; a group keeps its old name rather than none.
 */
export function renameNode(
  state: BuilderState,
  id: string,
  label: string,
): BuilderState {
  const node = state.nodes[id] as BuilderNode | undefined
  if (!node) return state
  const next = label.trim().slice(0, MAX_LABEL)
  let updated: BuilderNode
  if (node.kind === 'item') {
    const custom = next && next !== registry[node.key]?.label ? next : undefined
    const { label: _old, ...rest } = node
    updated = custom ? { ...rest, label: custom } : rest
  } else if (node.kind === 'group') {
    if (!next) return state
    updated = { ...node, label: next }
  } else {
    updated = { ...node, label: next }
  }
  return { ...state, nodes: { ...state.nodes, [id]: updated } }
}

export function toggleHidden(state: BuilderState, key: string): BuilderState {
  const hidden = state.hidden.includes(key)
    ? state.hidden.filter((k) => k !== key)
    : [...state.hidden, key]
  return { ...state, hidden }
}

export function addSection(
  state: BuilderState,
  label = 'New section',
): BuilderState {
  if (state.sections.length >= MAX_SECTIONS) return state
  const id = `sec:${state.seq + 1}`
  return {
    ...state,
    seq: state.seq + 1,
    sections: [...state.sections, id],
    nodes: { ...state.nodes, [id]: { kind: 'section', label, group: false } },
    containers: { ...state.containers, [containerId(id)]: [] },
  }
}

/** Remove a section; its links (also those in its groups) go to the tray. */
export function removeSection(
  state: BuilderState,
  sectionId: string,
): BuilderState {
  if (!state.sections.includes(sectionId)) return state
  const containers = { ...state.containers }
  const nodes = { ...state.nodes }
  const freed: string[] = []
  for (const child of containers[containerId(sectionId)]) {
    if (nodes[child].kind === 'group') {
      freed.push(...containers[containerId(child)])
      delete containers[containerId(child)]
      delete nodes[child]
    } else {
      freed.push(child)
    }
  }
  delete containers[containerId(sectionId)]
  delete nodes[sectionId]
  containers[TRAY] = [...containers[TRAY], ...freed]
  return {
    ...state,
    sections: state.sections.filter((id) => id !== sectionId),
    containers,
    nodes,
  }
}

export function addGroup(
  state: BuilderState,
  sectionId: string,
  label = 'New group',
): BuilderState {
  const inner = containerId(sectionId)
  if (!(inner in state.containers)) return state
  const id = `grp:${state.seq + 1}`
  return {
    ...state,
    seq: state.seq + 1,
    nodes: { ...state.nodes, [id]: { kind: 'group', label, icon: 'Folder' } },
    containers: {
      ...state.containers,
      [inner]: [...state.containers[inner], id],
      [containerId(id)]: [],
    },
  }
}

/** Remove a group; its links take its place in the section. */
export function removeGroup(
  state: BuilderState,
  groupId: string,
): BuilderState {
  const parent = findContainer(state, groupId)
  const node = state.nodes[groupId] as BuilderNode | undefined
  if (!parent || node?.kind !== 'group') return state
  const containers = { ...state.containers }
  const children = containers[containerId(groupId)]
  containers[parent] = containers[parent].flatMap((id) =>
    id === groupId ? children : [id],
  )
  delete containers[containerId(groupId)]
  const nodes = { ...state.nodes }
  delete nodes[groupId]
  return { ...state, containers, nodes }
}

export function setHomeRoute(
  state: BuilderState,
  homeRoute: string | null,
): BuilderState {
  return { ...state, homeRoute }
}

/** Same layout JSON = nothing to save. */
export const sameLayout = (a: NavLayout, b: NavLayout) =>
  JSON.stringify(a) === JSON.stringify(b)
