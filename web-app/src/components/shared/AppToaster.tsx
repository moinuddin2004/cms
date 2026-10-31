import { Check, Loader2, X } from 'lucide-react'
import { Toaster } from '@/components/ui/sonner'
import { useTheme } from '@/hooks/useTheme'

const ICON = 'size-3.5 stroke-[3]'
// Outlined lucide glyphs (Info, TriangleAlert) look doubled inside the round
// chip, so these two are plain marks.
const MARK = 'text-[13px] leading-none font-extrabold'

/**
 * The app's toaster (shadcn Sonner). Each type gets its own icon in a
 * coloured chip; the colours, stripe and tint live in styles.css
 * ("Toasts"), so success / error / warning read at a glance.
 */
export function AppToaster() {
  const { theme } = useTheme()
  return (
    <Toaster
      theme={theme}
      position="top-right"
      closeButton
      gap={8}
      toastOptions={{ duration: 4000 }}
      icons={{
        success: <Check className={ICON} />,
        error: <X className={ICON} />,
        warning: <span className={MARK}>!</span>,
        info: <span className={`${MARK} font-serif`}>i</span>,
        loading: <Loader2 className={`${ICON} animate-spin`} />,
      }}
    />
  )
}
