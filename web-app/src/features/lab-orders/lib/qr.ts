// Minimal QR code encoder (ISO/IEC 18004): byte mode, error-correction
// level M, versions 1–10 (up to 213 bytes — plenty for a work-order URL).
// Written here because the project has no QR dependency; the algorithm
// follows the reference structure (function patterns → interleaved
// Reed–Solomon codewords → zig-zag placement → best of 8 masks).

const MAX_VERSION = 10
/** Level M, versions 1–10. */
const ECC_PER_BLOCK = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26]
const NUM_BLOCKS = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5]
/** Format-info bits of level M. */
const ECL_M_BITS = 0

export type QrMatrix = boolean[][]

/** GF(2^8) multiply modulo x^8 + x^4 + x^3 + x^2 + 1. */
export function gfMul(x: number, y: number): number {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z & 0xff
}

export function rsDivisor(degree: number): number[] {
  const result: number[] = new Array<number>(degree - 1).fill(0)
  result.push(1)
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMul(result[j], root)
      if (j + 1 < result.length) result[j] ^= result[j + 1]
    }
    root = gfMul(root, 0x02)
  }
  return result
}

/** Reed–Solomon error-correction codewords of `data`. */
export function rsRemainder(data: number[], divisor: number[]): number[] {
  const result = divisor.map(() => 0)
  for (const b of data) {
    const factor = b ^ (result.shift() as number)
    result.push(0)
    divisor.forEach((coef, i) => (result[i] ^= gfMul(coef, factor)))
  }
  return result
}

/** The 15 format bits (level M) for a mask, BCH-coded and masked. */
export function formatBits(mask: number): number {
  const data = (ECL_M_BITS << 3) | mask
  let rem = data
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
  return ((data << 10) | rem) ^ 0x5412
}

function rawDataModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2
    result -= (25 * numAlign - 10) * numAlign - 55
    if (ver >= 7) result -= 36
  }
  return result
}

const dataCodewords = (ver: number) =>
  Math.floor(rawDataModules(ver) / 8) -
  ECC_PER_BLOCK[ver - 1] * NUM_BLOCKS[ver - 1]

function alignmentPositions(ver: number): number[] {
  if (ver === 1) return []
  const numAlign = Math.floor(ver / 7) + 2
  const step = Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2
  const result = [6]
  for (let pos = ver * 4 + 17 - 7; result.length < numAlign; pos -= step) {
    result.splice(1, 0, pos)
  }
  return result
}

const bit = (x: number, i: number) => ((x >>> i) & 1) !== 0

/** Encodes `text` (UTF-8) as a QR matrix; true = dark module. */
export function encodeQr(text: string): QrMatrix {
  const bytes = Array.from(new TextEncoder().encode(text))
  let ver = 1
  for (; ver <= MAX_VERSION; ver++) {
    const countBits = ver <= 9 ? 8 : 16
    if (4 + countBits + bytes.length * 8 <= dataCodewords(ver) * 8) break
  }
  if (ver > MAX_VERSION) throw new Error('Text too long for a QR code')

  // Data bits: mode, length, bytes, terminator, padding.
  const bits: number[] = []
  const append = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1)
  }
  append(0b0100, 4)
  append(bytes.length, ver <= 9 ? 8 : 16)
  bytes.forEach((b) => append(b, 8))
  const capacity = dataCodewords(ver) * 8
  append(0, Math.min(4, capacity - bits.length))
  append(0, (8 - (bits.length % 8)) % 8)
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) {
    append(pad, 8)
  }
  const data: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    data.push(bits.slice(i, i + 8).reduce((acc, b) => (acc << 1) | b, 0))
  }

  // Blocks + error correction, interleaved.
  const numBlocks = NUM_BLOCKS[ver - 1]
  const eccLen = ECC_PER_BLOCK[ver - 1]
  const rawCodewords = Math.floor(rawDataModules(ver) / 8)
  const numShort = numBlocks - (rawCodewords % numBlocks)
  const shortLen = Math.floor(rawCodewords / numBlocks)
  const divisor = rsDivisor(eccLen)
  const blocks: number[][] = []
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1))
    k += dat.length
    const ecc = rsRemainder(dat, divisor)
    if (i < numShort) dat.push(0)
    blocks.push(dat.concat(ecc))
  }
  const codewords: number[] = []
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortLen - eccLen || j >= numShort) codewords.push(block[i])
    })
  }

  // Function patterns.
  const size = ver * 4 + 17
  const modules: QrMatrix = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false),
  )
  const isFn: QrMatrix = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false),
  )
  const setFn = (x: number, y: number, dark: boolean) => {
    modules[y][x] = dark
    isFn[y][x] = true
  }
  for (let i = 0; i < size; i++) {
    setFn(6, i, i % 2 === 0)
    setFn(i, 6, i % 2 === 0)
  }
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy))
        const x = cx + dx
        const y = cy + dy
        if (x >= 0 && x < size && y >= 0 && y < size) {
          setFn(x, y, dist !== 2 && dist !== 4)
        }
      }
    }
  }
  finder(3, 3)
  finder(size - 4, 3)
  finder(3, size - 4)
  const align = alignmentPositions(ver)
  const n = align.length
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (
        (i === 0 && j === 0) ||
        (i === 0 && j === n - 1) ||
        (i === n - 1 && j === 0)
      )
        continue
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          setFn(
            align[i] + dx,
            align[j] + dy,
            Math.max(Math.abs(dx), Math.abs(dy)) !== 1,
          )
        }
      }
    }
  }
  const drawFormat = (mask: number) => {
    const f = formatBits(mask)
    for (let i = 0; i <= 5; i++) setFn(8, i, bit(f, i))
    setFn(8, 7, bit(f, 6))
    setFn(8, 8, bit(f, 7))
    setFn(7, 8, bit(f, 8))
    for (let i = 9; i < 15; i++) setFn(14 - i, 8, bit(f, i))
    for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, bit(f, i))
    for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, bit(f, i))
    setFn(8, size - 8, true)
  }
  drawFormat(0)
  if (ver >= 7) {
    let rem = ver
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
    const v = (ver << 12) | rem
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3)
      const b = Math.floor(i / 3)
      setFn(a, b, bit(v, i))
      setFn(b, a, bit(v, i))
    }
  }

  // Codewords in the zig-zag.
  let i = 0
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j
        const upward = ((right + 1) & 2) === 0
        const y = upward ? size - 1 - vert : vert
        if (!isFn[y][x] && i < codewords.length * 8) {
          modules[y][x] = bit(codewords[i >>> 3], 7 - (i & 7))
          i++
        }
      }
    }
  }

  // Best mask by the standard penalty (runs, 2×2 blocks, balance).
  const masked = (mask: number): QrMatrix =>
    modules.map((row, y) =>
      row.map((dark, x) => (isFn[y][x] ? dark : dark !== maskHit(mask, x, y))),
    )
  let best: QrMatrix | null = null
  let bestScore = Infinity
  for (let mask = 0; mask < 8; mask++) {
    drawFormat(mask)
    const m = masked(mask)
    const score = penalty(m)
    if (score < bestScore) {
      best = m
      bestScore = score
    }
  }
  return best as QrMatrix
}

function maskHit(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0
    case 1:
      return y % 2 === 0
    case 2:
      return x % 3 === 0
    case 3:
      return (x + y) % 3 === 0
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0
    default:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
  }
}

function penalty(m: QrMatrix): number {
  const size = m.length
  let score = 0
  const runs = (get: (a: number, b: number) => boolean) => {
    for (let a = 0; a < size; a++) {
      let run = 1
      for (let b = 1; b <= size; b++) {
        if (b < size && get(a, b) === get(a, b - 1)) run++
        else {
          if (run >= 5) score += run - 2
          run = 1
        }
      }
    }
  }
  runs((y, x) => m[y][x])
  runs((x, y) => m[y][x])
  let dark = 0
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (m[y][x]) dark++
      if (
        x < size - 1 &&
        y < size - 1 &&
        m[y][x] === m[y][x + 1] &&
        m[y][x] === m[y + 1][x] &&
        m[y][x] === m[y + 1][x + 1]
      ) {
        score += 3
      }
    }
  }
  const total = size * size
  score += Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10
  return score
}

/** SVG path data (one unit per module, 4-module quiet zone). */
export function qrPath(m: QrMatrix): { d: string; size: number } {
  const parts: string[] = []
  m.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) parts.push(`M${x + 4} ${y + 4}h1v1h-1z`)
    }),
  )
  return { d: parts.join(''), size: m.length + 8 }
}
