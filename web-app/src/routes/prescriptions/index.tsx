import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Loader2,
  Plus,
  FileText,
  ChevronDown,
  Library,
  Pill,
  ClipboardList,
  LayoutTemplate,
} from 'lucide-react'
import {
  usePrescriptions,
  usePrescriptionStats,
  PrescriptionStatus,
} from '@/features/prescriptions'

export const Route = createFileRoute('/prescriptions/')({
  component: () => (
    <RequireFeaturePage feature="patients.prescriptions">
      <PrescriptionsListPage />
    </RequireFeaturePage>
  ),
})

const STATUS_BADGE: Record<PrescriptionStatus, string> = {
  [PrescriptionStatus.DRAFT]: 'bg-amber-50 text-amber-700 border-amber-200',
  [PrescriptionStatus.FINALIZED]: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  [PrescriptionStatus.AMENDED]: 'bg-blue-50 text-blue-700 border-blue-200',
}

function PrescriptionsListPage() {
  const [status, setStatus] = useState<string>('all')
  const [page, setPage] = useState(1)
  const limit = 20

  const { data, isLoading } = usePrescriptions({
    status: status !== 'all' ? (status as PrescriptionStatus) : undefined,
    page,
    limit,
  })
  const { data: stats } = usePrescriptionStats()

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <DashboardLayout
      title="Prescriptions"
      subtitle="Create, review, and manage patient prescriptions."
      actions={
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Library className="mr-2 h-4 w-4" />
                Templates & Library
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Manage</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to={'/prescription-templates' as any}>
                  <LayoutTemplate className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span className="text-sm">Prescription Templates</span>
                    <span className="text-[10px] text-muted-foreground">
                      Letterhead, layout, fonts
                    </span>
                  </div>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to={'/treatment-plan-templates' as any}>
                  <ClipboardList className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span className="text-sm">Treatment Plans</span>
                    <span className="text-[10px] text-muted-foreground">
                      Reusable medicine bundles
                    </span>
                  </div>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to={'/medicine-directory' as any}>
                  <Pill className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span className="text-sm">Medicine Directory</span>
                    <span className="text-[10px] text-muted-foreground">
                      Drug catalogue & autocomplete
                    </span>
                  </div>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button asChild>
            <Link to={'/prescriptions/new' as any}>
              <Plus className="mr-2 h-4 w-4" />
              New Prescription
            </Link>
          </Button>
        </>
      }
    >
      <div className="space-y-4">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total" value={stats?.total ?? 0} />
          <StatCard label="This month" value={stats?.thisMonth ?? 0} />
          <StatCard label="Drafts" value={stats?.draft ?? 0} tone="amber" />
          <StatCard
            label="Finalized"
            value={stats?.finalized ?? 0}
            tone="emerald"
          />
        </div>

        {/* Filters */}
        <div className="bg-card border rounded-xl p-3 flex flex-wrap items-center gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value={PrescriptionStatus.DRAFT}>Drafts</SelectItem>
              <SelectItem value={PrescriptionStatus.FINALIZED}>
                Finalized
              </SelectItem>
              <SelectItem value={PrescriptionStatus.AMENDED}>Amended</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto text-xs text-muted-foreground">
            {total} prescription{total === 1 ? '' : 's'}
            {totalPages > 1 && ` · page ${page}/${totalPages}`}
          </div>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>RX #</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Medicines</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : (data?.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-40 text-center text-muted-foreground"
                    >
                      <FileText className="w-8 h-8 mx-auto opacity-30 mb-2" />
                      No prescriptions yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  (data?.data ?? []).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">
                        {p.prescriptionNumber}
                      </TableCell>
                      <TableCell className="font-medium">
                        {p.patient?.fullName ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {p.doctor?.fullName ? `Dr. ${p.doctor.fullName}` : '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {p.medicines?.length ?? 0}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={STATUS_BADGE[p.status]}
                        >
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(p.createdAt).toLocaleDateString('en-GB')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <Link
                            to={'/prescriptions/$prescriptionId' as any}
                            params={{ prescriptionId: p.id } as any}
                          >
                            Open
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {totalPages > 1 && (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground px-2">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: 'amber' | 'emerald'
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={`text-2xl font-bold mt-1 ${
            tone === 'amber'
              ? 'text-amber-700'
              : tone === 'emerald'
                ? 'text-emerald-700'
                : 'text-foreground'
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  )
}
