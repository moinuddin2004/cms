import { describe, expect, it } from 'vitest'
import { DEFAULT_NAV_LAYOUT } from '@/features/access'
import type { NavLayout } from '@/features/access'
import {
  TRAY,
  addGroup,
  addSection,
  containerId,
  fromLayout,
  itemId,
  moveNode,
  moveSection,
  removeGroup,
  removeSection,
  renameNode,
  toLayout,
  toggleHidden,
} from './lib/builder-state'

const LAYOUT: NavLayout = {
  sections: [
    { items: [{ key: 'nav.dashboard' }] },
    {
      label: 'Clinic',
      items: [
        { key: 'nav.patients' },
        { key: 'nav.appointments' },
        {
          label: 'Billing',
          group: true,
          icon: 'HandCoins',
          items: [{ key: 'nav.billing.desk' }, { key: 'nav.invoices' }],
        },
      ],
    },
  ],
  hidden: [],
}

describe('nav builder state', () => {
  it('round-trips a layout; registry pages not placed sit in the tray', () => {
    const state = fromLayout(LAYOUT)
    expect(toLayout(state)).toEqual(LAYOUT)
    expect(state.containers[TRAY]).toContain(itemId('nav.payroll'))
    expect(state.containers[TRAY]).not.toContain(itemId('nav.settings'))
    // The code default round-trips unchanged too.
    expect(toLayout(fromLayout(DEFAULT_NAV_LAYOUT))).toEqual(DEFAULT_NAV_LAYOUT)
  })

  it('drops unknown and repeated keys', () => {
    const state = fromLayout({
      sections: [
        { items: [{ key: 'nav.gone' }, { key: 'nav.patients' }] },
        { items: [{ key: 'nav.patients' }] },
      ],
      hidden: ['nav.gone', 'nav.patients'],
    })
    expect(toLayout(state)).toEqual({
      sections: [{ items: [{ key: 'nav.patients' }] }, { items: [] }],
      hidden: ['nav.patients'],
    })
  })

  it('reorders inside a section', () => {
    const s = fromLayout(LAYOUT)
    const clinic = s.sections[1]
    const next = moveNode(s, itemId('nav.appointments'), containerId(clinic), 0)
    expect(
      toLayout(next).sections[1].items.map((i) =>
        'key' in i ? i.key : i.label,
      ),
    ).toEqual(['nav.appointments', 'nav.patients', 'Billing'])
  })

  it('moves a link across sections and into a group', () => {
    const s = fromLayout(LAYOUT)
    const [first, clinic] = s.sections
    const billing = s.containers[containerId(clinic)][2]
    let next = moveNode(s, itemId('nav.patients'), containerId(first), 1)
    next = moveNode(next, itemId('nav.dashboard'), containerId(billing), 0)
    expect(toLayout(next).sections).toEqual([
      { items: [{ key: 'nav.patients' }] },
      {
        label: 'Clinic',
        items: [
          { key: 'nav.appointments' },
          {
            label: 'Billing',
            group: true,
            icon: 'HandCoins',
            items: [
              { key: 'nav.dashboard' },
              { key: 'nav.billing.desk' },
              { key: 'nav.invoices' },
            ],
          },
        ],
      },
    ])
  })

  it('places a page from the tray; groups never nest', () => {
    const s = fromLayout(LAYOUT)
    const [first, clinic] = s.sections
    const billing = s.containers[containerId(clinic)][2]
    const placed = moveNode(s, itemId('nav.payroll'), containerId(first), 99)
    expect(toLayout(placed).sections[0].items).toEqual([
      { key: 'nav.dashboard' },
      { key: 'nav.payroll' },
    ])
    expect(moveNode(placed, billing, TRAY, 0)).toBe(placed)
    const group2 = addGroup(placed, first)
    const newGroup = group2.containers[containerId(first)].at(-1)!
    expect(moveNode(group2, newGroup, containerId(billing), 0)).toBe(group2)
  })

  it('reorders sections', () => {
    const s = fromLayout(LAYOUT)
    const next = moveSection(s, s.sections[1], 0)
    expect(toLayout(next).sections.map((x) => x.label ?? null)).toEqual([
      'Clinic',
      null,
    ])
  })

  it('renames, hides, and resets a rename to the registry label', () => {
    let s = fromLayout(LAYOUT)
    s = renameNode(s, itemId('nav.billing.desk'), '  Cash counter ')
    s = toggleHidden(s, 'nav.invoices')
    let out = toLayout(s)
    const group = out.sections[1].items[2]
    expect(group).toMatchObject({
      items: [
        { key: 'nav.billing.desk', label: 'Cash counter' },
        { key: 'nav.invoices' },
      ],
    })
    expect(out.hidden).toEqual(['nav.invoices'])
    s = renameNode(s, itemId('nav.billing.desk'), 'Billing desk')
    s = toggleHidden(s, 'nav.invoices')
    out = toLayout(s)
    expect(out).toEqual(LAYOUT)
  })

  it('adds and removes sections and groups', () => {
    let s = addSection(fromLayout(LAYOUT), 'Team')
    const team = s.sections.at(-1)!
    s = moveNode(s, itemId('nav.employees'), containerId(team), 0)
    s = addGroup(s, team, 'People')
    const people = s.containers[containerId(team)].at(-1)!
    s = moveNode(s, itemId('nav.payroll'), containerId(people), 0)
    expect(toLayout(s).sections[2]).toEqual({
      label: 'Team',
      items: [
        { key: 'nav.employees' },
        {
          label: 'People',
          group: true,
          icon: 'Folder',
          items: [{ key: 'nav.payroll' }],
        },
      ],
    })
    // Ungroup: its links take its place.
    const ungrouped = removeGroup(s, people)
    expect(toLayout(ungrouped).sections[2].items).toEqual([
      { key: 'nav.employees' },
      { key: 'nav.payroll' },
    ])
    // Remove the section: everything goes back to the tray.
    const removed = removeSection(s, team)
    expect(toLayout(removed)).toEqual(LAYOUT)
    expect(removed.containers[TRAY]).toEqual(
      expect.arrayContaining([itemId('nav.employees'), itemId('nav.payroll')]),
    )
  })
})
