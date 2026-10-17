import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { FeatureGuard } from '@/context/FeatureFlagsContext'
import { BillingSettingsForm } from '../components/settings/BillingSettingsForm'
import { DiscountTypesTab } from '../components/settings/DiscountTypesTab'
import { PaymentAccountsTab } from '../components/settings/PaymentAccountsTab'
import { ServicesTab } from '../components/settings/ServicesTab'

/** Admin billing configuration (plan §8.3). */
export function BillingSettingsPage() {
  return (
    <DashboardLayout
      title="Billing settings"
      subtitle="Services, prices, discounts, payment accounts and printing"
      backTo="/settings"
      backLabel="Back to settings"
    >
      <Tabs defaultValue="services">
        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-muted/50 p-1">
          <TabsTrigger value="services" className="text-sm">
            Services and prices
          </TabsTrigger>
          <FeatureGuard feature="billing.discounts">
            <TabsTrigger value="discounts" className="text-sm">
              Discount types
            </TabsTrigger>
          </FeatureGuard>
          <TabsTrigger value="payments" className="text-sm">
            Payments and printing
          </TabsTrigger>
          <TabsTrigger value="accounts" className="text-sm">
            Payment accounts
          </TabsTrigger>
        </TabsList>
        <TabsContent
          value="services"
          className="mt-4 animate-in fade-in duration-300"
        >
          <ServicesTab />
        </TabsContent>
        <TabsContent
          value="discounts"
          className="mt-4 animate-in fade-in duration-300"
        >
          <DiscountTypesTab />
        </TabsContent>
        <TabsContent
          value="payments"
          className="mt-4 animate-in fade-in duration-300"
        >
          <BillingSettingsForm />
        </TabsContent>
        <TabsContent
          value="accounts"
          className="mt-4 animate-in fade-in duration-300"
        >
          <PaymentAccountsTab />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  )
}
