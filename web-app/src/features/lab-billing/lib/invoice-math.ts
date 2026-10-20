// Mirrors the server's lab billing math (integer paisa, half-up per line,
// invoice discount spread by largest remainder) so previews match exactly.

const half = (value: number, bp: number) =>
  Number((BigInt(value) * BigInt(bp) + 5000n) / 10000n)

export function spreadDiscount(gross: number[], discount: number): number[] {
  const total = gross.reduce((a, g) => a + g, 0)
  if (discount <= 0 || total === 0) return gross.map(() => 0)
  const exact = gross.map((g) => BigInt(g) * BigInt(discount))
  const shares = exact.map((e) => Number(e / BigInt(total)))
  let left = discount - shares.reduce((a, s) => a + s, 0)
  const order = exact
    .map((e, i) => ({ i, rem: e % BigInt(total) }))
    .sort((a, b) => (b.rem > a.rem ? 1 : b.rem < a.rem ? -1 : a.i - b.i))
  for (const { i } of order) {
    if (left === 0) break
    if (shares[i] < gross[i]) {
      shares[i] += 1
      left -= 1
    }
  }
  return shares
}

export interface InvoicePreview {
  subtotalPaisa: number
  discountPaisa: number
  taxPaisa: number
  totalPaisa: number
}

/** Totals of `gross` line amounts with an invoice discount and one tax rate. */
export function previewInvoice(
  gross: number[],
  discountPaisa: number,
  taxRateBp: number,
): InvoicePreview {
  const subtotalPaisa = gross.reduce((a, g) => a + g, 0)
  const d = Math.min(Math.max(discountPaisa, 0), subtotalPaisa)
  const discounts = spreadDiscount(gross, d)
  const taxPaisa = gross.reduce(
    (a, g, i) => a + half(g - discounts[i], taxRateBp),
    0,
  )
  return {
    subtotalPaisa,
    discountPaisa: d,
    taxPaisa,
    totalPaisa: subtotalPaisa - d + taxPaisa,
  }
}
