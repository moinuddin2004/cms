import { useMemo } from 'react'
import { encodeQr, qrPath } from '../lib/qr'

/** A QR code as an inline SVG (scales crisply on screen and in print). */
export function QrCode({
  value,
  size = 112,
  label,
}: {
  value: string
  size?: number
  label?: string
}) {
  const { d, size: units } = useMemo(() => qrPath(encodeQr(value)), [value])
  return (
    <svg
      role="img"
      aria-label={label ?? 'QR code'}
      width={size}
      height={size}
      viewBox={`0 0 ${units} ${units}`}
      shapeRendering="crispEdges"
      className="bg-white text-black"
    >
      <path d={d} fill="currentColor" />
    </svg>
  )
}
