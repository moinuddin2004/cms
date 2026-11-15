import { useState } from 'react'
import { Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PublicShell } from '../components/PublicShell'
import {
  APP_STORE_URL,
  PLAY_STORE_URL,
  claimDeepLink,
  isTokenShape,
} from '../utils/links'

/**
 * `/c/$token` — a printed or shared claim link. Opens the app via its deep
 * link; if the app is not installed the patient gets the store buttons.
 */
export function ClaimLandingPage({ token }: { token: string }) {
  const [tried, setTried] = useState(false)

  if (!isTokenShape(token)) {
    return (
      <PublicShell>
        <h1 className="text-lg font-semibold">This link isn&apos;t valid</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ask your clinic to show you a new code.
        </p>
      </PublicShell>
    )
  }

  const open = () => {
    setTried(true)
    window.location.href = claimDeepLink(token)
  }
  const hasStore = !!(PLAY_STORE_URL || APP_STORE_URL)

  return (
    <PublicShell>
      <Smartphone className="mx-auto size-10 text-primary" />
      <h1 className="mt-3 text-lg font-semibold">Link your clinic record</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Open the app to connect your visit history. This link works once and
        expires 15 minutes after the clinic created it.
      </p>
      <Button className="mt-5 w-full" onClick={open}>
        Open the app
      </Button>
      {tried && (
        <p className="mt-4 text-sm text-muted-foreground">
          Nothing happened? Install the app first, then open this link again.
        </p>
      )}
      {(tried || hasStore) && (
        <div className="mt-3 flex flex-col gap-2">
          {PLAY_STORE_URL && (
            <Button variant="outline" asChild>
              <a href={PLAY_STORE_URL} rel="noreferrer">
                Get it on Google Play
              </a>
            </Button>
          )}
          {APP_STORE_URL && (
            <Button variant="outline" asChild>
              <a href={APP_STORE_URL} rel="noreferrer">
                Download on the App Store
              </a>
            </Button>
          )}
          {!hasStore && (
            <p className="text-xs text-muted-foreground">
              Store links are coming soon — ask your clinic how to get the app.
            </p>
          )}
        </div>
      )}
    </PublicShell>
  )
}
