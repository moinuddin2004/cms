import { Button } from '@/components/ui/button'

export function RouteError({ error, reset }: { error: Error; reset?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <h2 className="text-lg font-semibold text-destructive">Something went wrong</h2>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      {reset && <Button variant="outline" onClick={reset}>Try again</Button>}
    </div>
  )
}
