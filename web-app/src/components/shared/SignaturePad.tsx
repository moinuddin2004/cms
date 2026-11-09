import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { Button } from '@/components/ui/button'
import { Eraser } from 'lucide-react'

export interface SignaturePadHandle {
  /** True when nothing has been drawn yet. */
  isEmpty: () => boolean
  /** Clear the canvas. */
  clear: () => void
  /** PNG data URL of the current drawing, or null if empty. */
  toDataURL: () => string | null
  /** PNG Blob of the current drawing, or null if empty. */
  toBlob: () => Promise<Blob | null>
}

interface SignaturePadProps {
  /** Drawing area height in px (width is responsive). */
  height?: number
  className?: string
  disabled?: boolean
}

/**
 * Lightweight, dependency-free signature pad.
 *
 * Renders an HTML canvas the user signs on with mouse/touch/stylus (Pointer
 * Events). Parent grabs the result imperatively via the forwarded ref:
 * `ref.current.toBlob()` → upload → store the returned URL.
 */
export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  function SignaturePad({ height = 180, className, disabled }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const drawing = useRef(false)
    const hasDrawn = useRef(false)
    const [empty, setEmpty] = useState(true)

    // Size the canvas backing store to its rendered size (account for DPR).
    const resizeCanvas = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Preserve existing drawing across resizes.
      const prev =
        hasDrawn.current && canvas.width > 0 ? canvas.toDataURL() : null

      const ratio = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * ratio
      canvas.height = height * ratio
      ctx.scale(ratio, ratio)
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = '#0f172a'

      if (prev) {
        const img = new Image()
        img.onload = () => ctx.drawImage(img, 0, 0, rect.width, height)
        img.src = prev
      }
    }

    useEffect(() => {
      resizeCanvas()
      window.addEventListener('resize', resizeCanvas)
      return () => window.removeEventListener('resize', resizeCanvas)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current!.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (disabled) return
      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx) return
      drawing.current = true
      const { x, y } = pos(e)
      ctx.beginPath()
      ctx.moveTo(x, y)
      canvasRef.current?.setPointerCapture(e.pointerId)
    }

    const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawing.current || disabled) return
      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx) return
      const { x, y } = pos(e)
      ctx.lineTo(x, y)
      ctx.stroke()
      if (!hasDrawn.current) {
        hasDrawn.current = true
        setEmpty(false)
      }
    }

    const end = () => {
      drawing.current = false
    }

    const clear = () => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      hasDrawn.current = false
      setEmpty(true)
    }

    useImperativeHandle(ref, () => ({
      isEmpty: () => !hasDrawn.current,
      clear,
      toDataURL: () =>
        hasDrawn.current
          ? (canvasRef.current?.toDataURL('image/png') ?? null)
          : null,
      toBlob: () =>
        new Promise<Blob | null>((resolve) => {
          if (!hasDrawn.current || !canvasRef.current) return resolve(null)
          canvasRef.current.toBlob((blob) => resolve(blob), 'image/png')
        }),
    }))

    return (
      <div className={className}>
        <div className="relative rounded-md border bg-white">
          <canvas
            ref={canvasRef}
            style={{ height, touchAction: 'none' }}
            className="w-full rounded-md"
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
          />
          {empty && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm italic text-muted-foreground">
              Sign here
            </span>
          )}
        </div>
        <div className="mt-2 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clear}
            disabled={disabled || empty}
          >
            <Eraser size={14} className="mr-1.5" /> Clear
          </Button>
        </div>
      </div>
    )
  },
)
