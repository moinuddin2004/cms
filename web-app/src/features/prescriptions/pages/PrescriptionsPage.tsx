import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Loader2, Plus, FileText, ChevronDown, Library, Pill, ClipboardList, LayoutTemplate } from 'lucide-react'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { usePrescriptions, usePrescriptionStats, PrescriptionStatus } from '@/features/prescriptions'

const STATUS_BADGE: Record<PrescriptionStatus, string> = {
  [PrescriptionStatus.DRAFT]: 'bg-amber-soft text-amber',
  [PrescriptionStatus.FINALIZED]: 'bg-emerald-soft text-emerald',
  [PrescriptionStatus.AMENDED]: 'bg-primary-soft text-primary-text',
}

export function PrescriptionsPage() {
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
    <>
      <PageWrapper
        title="Prescriptions"
        subtitle="Create, review, and manage patient prescriptions."
        actions={
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Library className="mr-2 size-4" />
                  Templates & Library
                  <ChevronDown className="ml-1 size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Manage</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to={'/prescription-templates' as any}>
                    <LayoutTemplate className="mr-2 size-4" />
                    <div className="flex flex-col">
                      <span className="text-sm">Prescription Templates</span>
                      <span className="text-[10px] text-text-3">Letterhead, layout, fonts</span>
                    </div>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to={'/treatment-plan-templates' as any}>
                    <ClipboardList className="mr-2 size-4" />
                    <div className="flex flex-col">
                      <span className="text-sm">Treatment Plans</span>
                      <span className="text-[10px] text-text-3">Reusable medicine bundles</span>
                    </div>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to={'/medicine-directory' as any}>
                    <Pill className="mr-2 size-4" />
                    <div className="flex flex-col">
                      <span className="text-sm">Medicine Directory</span>
                      <span className="text-[10px] text-text-3">Drug catalogue & autocomplete</span>
                    </div>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button asChild size="sm">
              <Link to={'/prescriptions/new' as any}>
                <Plus className="mr-1.5 size-3.5" />
                Create
              </Link>
            </Button>
          </div>
        }
      />
      <div className="mt-5 space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Total" value={stats?.total ?? 0} />
          <StatCard label="This month" value={stats?.thisMonth ?? 0} />
          <StatCard label="Drafts" value={stats?.draft ?? 0} tone="amber" />
          <StatCard label="Finalized" value={stats?.finalized ?? 0} tone="emerald" />
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-2 px-2.5">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 w-[160px] text-xs" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value={PrescriptionStatus.DRAFT}>Drafts</SelectItem>
              <SelectItem value={PrescriptionStatus.FINALIZED}>Finalized</SelectItem>
              <SelectItem value={PrescriptionStatus.AMENDED}>Amended</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto text-xs text-text-3">
            {total} prescription{total === 1 ? '' : 's'}
            {totalPages > 1 && ` · page ${page}/${totalPages}`}
          </div>
        </div>

        <Card className="py-0">
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
                      <Loader2 className="mx-auto size-6 animate-spin text-text-3" />
                    </TableCell>
                  </TableRow>
                ) : (data?.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-40 text-center text-text-3">
                      <FileText className="mx-auto mb-2 size-8 opacity-30" />
                      No prescriptions yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  (data?.data ?? []).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.prescriptionNumber}</TableCell>
                      <TableCell className="font-medium">{p.patient?.fullName ?? '—'}</TableCell>
                      <TableCell className="text-sm">{p.doctor?.fullName ? `Dr. ${p.doctor.fullName}` : '—'}</TableCell>
                      <TableCell className="text-sm">{p.medicines?.length ?? 0}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_BADGE[p.status]}>{p.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-text-3">{new Date(p.createdAt).toLocaleDateString('en-GB')}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={'/prescriptions/$prescriptionId' as any} params={{ prescriptionId: p.id } as any}>Open</Link>
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
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
            <span className="px-2 text-xs text-text-3">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</Button>
          </div>
        )}
      </div>
    </>
  )
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: 'amber' | 'emerald' }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-text-3">{label}</p>
        <p className={`mt-1 text-2xl font-bold ${tone === 'amber' ? 'text-amber' : tone === 'emerald' ? 'text-emerald' : 'text-foreground'}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  )
}
