import { AlertCircle, Package, TrendingDown, Clock, XCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/formatters'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { useAuthStore } from '@/store/useAuthStore'
import { ItemsTab, SuppliersTab, PurchaseOrdersTab, TemplatesTab, useInventoryStats } from '@/features/inventory'

export function InventoryPage() {
  const { activeLocationId } = useAuthStore()

  if (!activeLocationId) {
    return (
      <>
        <PageWrapper
          title="Inventory"
        />
        <div className="mt-5 flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
          <div className="rounded-full bg-amber-soft p-6">
            <AlertCircle className="size-12 text-amber" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Select a location first</h2>
            <p className="text-text-2">You need to select a clinic location to manage inventory.</p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <PageWrapper
        title="Inventory Management"
        subtitle="Track supplies, suppliers, purchase orders and consumption"
      />
      <div className="mt-5 space-y-5">
        <StatsCards />
        <Tabs defaultValue="items">
          <TabsList>
            <TabsTrigger value="items">Items</TabsTrigger>
            <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
            <TabsTrigger value="purchase-orders">Purchase Orders</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>
          <TabsContent value="items" className="pt-4"><ItemsTab /></TabsContent>
          <TabsContent value="suppliers" className="pt-4"><SuppliersTab /></TabsContent>
          <TabsContent value="purchase-orders" className="pt-4"><PurchaseOrdersTab /></TabsContent>
          <TabsContent value="templates" className="pt-4"><TemplatesTab /></TabsContent>
        </Tabs>
      </div>
    </>
  )
}

function StatsCards() {
  const { data: stats, isLoading } = useInventoryStats()

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    )
  }

  const cards = [
    { label: 'Total Items', value: stats?.totalItems ?? 0, icon: Package, color: 'text-foreground' },
    { label: 'Total Value', value: formatCurrency(stats?.totalValue ?? 0), icon: Package, color: 'text-foreground' },
    { label: 'Low Stock', value: stats?.lowStockCount ?? 0, icon: TrendingDown, color: 'text-amber' },
    { label: 'Expiring', value: stats?.expiringCount ?? 0, icon: Clock, color: 'text-danger' },
    { label: 'Out of Stock', value: stats?.outOfStockCount ?? 0, icon: XCircle, color: 'text-text-3' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {cards.map((c) => {
        const Icon = c.icon
        return (
          <Card key={c.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <Icon className={cn('size-5', c.color)} />
              <div>
                <p className="text-xs text-text-3">{c.label}</p>
                <p className={cn('text-lg font-bold', c.color)}>{c.value}</p>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
