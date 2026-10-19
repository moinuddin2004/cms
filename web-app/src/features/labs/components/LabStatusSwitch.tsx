import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useSetLabStatus } from '../hooks/useLabDirectory'
import type { Lab } from '../types'

/**
 * Active / suspended toggle for a platform lab. Suspending is confirmed —
 * every clinic working with the lab stops being able to send it work.
 */
export function LabStatusSwitch({ lab }: { lab: Lab }) {
  const setStatus = useSetLabStatus()
  const [confirming, setConfirming] = useState(false)
  const active = lab.status === 'active'

  return (
    <span onClick={(e) => e.stopPropagation()} className="inline-flex">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Switch
                size="sm"
                checked={active}
                disabled={setStatus.isPending}
                aria-label={
                  active ? `Suspend ${lab.name}` : `Activate ${lab.name}`
                }
                onCheckedChange={(on) =>
                  on
                    ? setStatus.mutate({ lab, status: 'active' })
                    : setConfirming(true)
                }
              />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {active
              ? 'Active — click to suspend'
              : 'Suspended — click to activate'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Suspend ${lab.name}?`}
        description={
          lab.activeLinkCount > 0 ? (
            <>
              <strong>{lab.activeLinkCount}</strong> clinic
              {lab.activeLinkCount === 1 ? '' : 's'} work with this lab. They
              keep their history but can’t activate or add it until you
              reactivate it.
            </>
          ) : (
            'Clinics will not be able to add this lab until you reactivate it.'
          )
        }
        confirmLabel="Suspend lab"
        destructive
        isLoading={setStatus.isPending}
        onConfirm={() =>
          setStatus.mutate(
            { lab, status: 'suspended' },
            { onSuccess: () => setConfirming(false) },
          )
        }
      />
    </span>
  )
}
