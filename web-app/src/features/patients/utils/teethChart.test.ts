import { describe, expect, it } from 'vitest'
import {
  ARCHES,
  applyCondition,
  chartStats,
  cycleSurface,
  findingsOf,
  normalizeChart,
  plannedWork,
  removeFinding,
  serializeChart,
  toggleFindingPlanned,
} from './teethChart'
import { ARCH_LAYOUT } from './odontogramGeometry'

describe('normalizeChart', () => {
  it('reads legacy whole-tooth values', () => {
    const data = normalizeChart({
      '16': 'CARIES',
      '11': { condition: 'FILLED', note: 'old' },
      '26': { condition: 'CROWN' },
      '46': { condition: 'EXTRACTION_NEEDED' },
      '31': { condition: 'HEALTHY' },
    })
    expect(Object.keys(data['16'].surfaces!).sort()).toEqual(
      ['B', 'D', 'L', 'M', 'O'].sort(),
    )
    // Front tooth: the biting surface is incisal.
    expect(data['11'].surfaces!.I).toEqual({
      condition: 'FILLED',
      planned: false,
    })
    expect(data['11'].note).toBe('old')
    expect(data['26'].condition).toBe('CROWN')
    expect(data['46'].planned).toBe(true)
    expect(data['31']).toBeUndefined()
  })
})

describe('editing', () => {
  it('toggles a surface mark, and replaces it on a different status', () => {
    let d = applyCondition({}, 16, 'CARIES', false, 'O')
    expect(d['16'].surfaces!.O).toEqual({ condition: 'CARIES', planned: false })
    d = applyCondition(d, 16, 'CARIES', true, 'O')
    expect(d['16'].surfaces!.O!.planned).toBe(true)
    d = applyCondition(d, 16, 'CARIES', true, 'O')
    expect(d['16']).toBeUndefined()
  })

  it('returns the same object when nothing changes', () => {
    const d = applyCondition({}, 16, 'MISSING', false)
    expect(applyCondition(d, 16, 'CARIES', false, 'O')).toBe(d)
  })

  it('clears surfaces and root canal when a tooth goes missing', () => {
    let d = applyCondition({}, 36, 'FILLED', false, 'M')
    d = applyCondition(d, 36, 'ROOT_CANAL', false)
    d = applyCondition(d, 36, 'MISSING', false)
    expect(d['36']).toEqual({ condition: 'MISSING', planned: false })
  })

  it('always plans an extraction', () => {
    const d = applyCondition({}, 46, 'EXTRACTION_NEEDED', false)
    expect(d['46'].planned).toBe(true)
  })

  it('cycles a surface caries → filled → clear', () => {
    let d = cycleSurface({}, 14, 'D', false)
    expect(d['14'].surfaces!.D!.condition).toBe('CARIES')
    d = cycleSurface(d, 14, 'D', false)
    expect(d['14'].surfaces!.D!.condition).toBe('FILLED')
    d = cycleSurface(d, 14, 'D', false)
    expect(d['14']).toBeUndefined()
  })

  it('groups surface marks into findings and edits them together', () => {
    let d = applyCondition({}, 36, 'FILLED', false, 'D')
    d = applyCondition(d, 36, 'FILLED', false, 'M')
    d = applyCondition(d, 36, 'FILLED', false, 'O')
    d = applyCondition(d, 36, 'ROOT_CANAL', true)
    const f = findingsOf(d['36'])
    expect(f.map((x) => x.condition)).toEqual(['ROOT_CANAL', 'FILLED'])
    expect(f[1].surfaces.join('')).toBe('MOD')

    d = toggleFindingPlanned(d, 36, f[1])
    expect(findingsOf(d['36'])[1].planned).toBe(true)
    d = removeFinding(d, 36, findingsOf(d['36'])[0])
    expect(d['36'].rootCanal).toBeUndefined()
    expect(chartStats(d)).toEqual({ teeth: 1, findings: 1, planned: 1 })
    expect(plannedWork(d)).toHaveLength(1)
  })

  it('serializes without empty teeth or false flags', () => {
    let d = applyCondition({}, 16, 'CARIES', false, 'O')
    d = { ...d, '17': { note: '   ' } }
    expect(serializeChart(d)).toEqual({
      '16': { surfaces: { O: { condition: 'CARIES' } } },
    })
  })
})

describe('arch geometry', () => {
  for (const dentition of ['permanent', 'primary'] as const) {
    const layout = ARCH_LAYOUT[dentition]
    for (const row of [ARCHES[dentition].upper, ARCHES[dentition].lower]) {
      it(`${dentition}: mesial faces the midline, buccal faces out`, () => {
        const half = row.length / 2
        row.forEach((t, i) => {
          const g = layout[t]
          const phi = (g.rotate * Math.PI) / 180
          // Neighbour towards the midline (across it for the central incisors).
          const n = layout[row[i < half ? i + 1 : i - 1]]
          const mx = g.mesialSign * Math.cos(phi)
          const my = g.mesialSign * Math.sin(phi)
          const before = Math.hypot(n.x - g.x, n.y - g.y)
          const after = Math.hypot(n.x - g.x - mx * 5, n.y - g.y - my * 5)
          expect(after).toBeLessThan(before)
          // Local +y (buccal) matches the outward normal.
          expect(-Math.sin(phi) * g.nx + Math.cos(phi) * g.ny).toBeCloseTo(1)
        })
      })
    }
  }
})
