import { useState } from 'react'
import { Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ErrorState, LoadingSkeleton } from '@/components/shared'
import { useBillingAccess } from '@/features/billing'
import { InvoicesList } from '../components/InvoicesList'
import { PaymentsList } from '../components/PaymentsList'
import { SettingsSheet } from '../components/SettingsSheet'

/** Patient billing for lab work (lab ERD §6a): invoices + estimates, payments. */
export function LabBillingPage() {
  const access = useBillingAccess()
  const [tab, setTab] = useState('invoices')
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <DashboardLayout
      title="Lab billing"
      subtitle="What patients are billed and pay for lab work — kept apart from clinic billing."
      actions={
        access.isAdmin ? (
          <Button variant="outline" onClick={() => setSettingsOpen(true)}>
            <Settings className="size-4" /> Settings
          </Button>
        ) : undefined
      }
    >
      {access.isLoading ? (
        <LoadingSkeleton variant="table" />
      ) : !access.canBill ? (
        <ErrorState
          title="Front desk only"
          description="Lab billing is open to clinic admins and reception."
        />
      ) : (
        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
          </TabsList>
          <TabsContent value="invoices">
            <InvoicesList />
          </TabsContent>
          <TabsContent value="payments">
            <PaymentsList />
          </TabsContent>
        </Tabs>
      )}
      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
    </DashboardLayout>
  )
}
