import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  Pagination,
  StatusBadge,
} from '@/components/shared'
import { formatPaisa } from '@/features/lab-catalog'
import {
  BillStatusBadge,
  LINE_KIND_LABEL,
  METHOD_LABEL,
  StatementStatusBadge,
} from '@/features/lab-payables'
import type {
  LabStatement,
  Paginated,
  VendorBill,
  VendorBillDetail,
  VendorPayment,
} from '@/features/lab-payables'
import api from '@/lib/api'
import { LabPortalLayout } from '../components/LabPortalLayout'
import { useActiveLab } from '../hooks/useLabPortal'
import { labPortalKeys } from '../query-keys'

const get = async <T,>(url: string, params?: object) =>
  (await api.get(url, { params })).data.data as T
const base = '/lab-portal/payables'

/** Read-only: what clinics approved for this lab, and what they paid. */
export const labBillingApi = {
  bills: (p: { page: number; limit: number }) =>
    get<Paginated<VendorBill>>(`${base}/bills`, p),
  bill: (id: string) => get<VendorBillDetail>(`${base}/bills/${id}`),
  payments: (p: { page: number; limit: number }) =>
    get<Paginated<VendorPayment>>(`${base}/payments`, p),
  statements: (p: { page: number; limit: number }) =>
    get<Paginated<LabStatement>>(`${base}/statements`, p),
}

function usePortalList<T>(
  name: 'bills' | 'payments' | 'statements',
  page: number,
  limit: number,
) {
  const { labId } = useActiveLab()
  return useQuery({
    queryKey: [...labPortalKeys.all, labId, 'payables', name, page, limit],
    queryFn: () =>
      labBillingApi[name]({ page, limit }) as Promise<Paginated<T>>,
    enabled: !!labId,
    placeholderData: keepPreviousData,
  })
}

const th = 'px-3 py-2 text-left text-xs font-medium text-text-3'
const td = 'px-3 py-2'

/**
 * The lab's billing view (lab ERD §6b): bills clinics approved, payments
 * received and statements on file. Lab costs only — never clinic prices.
 */
export function LabBillingPage() {
  return (
    <LabPortalLayout
      title="Billing"
      subtitle="Bills clinics approved for your work, and what they paid."
    >
      <Tabs defaultValue="bills" className="space-y-4">
        <TabsList>
          <TabsTrigger value="bills">Bills</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="statements">Statements</TabsTrigger>
        </TabsList>
        <TabsContent value="bills">
          <Bills />
        </TabsContent>
        <TabsContent value="payments">
          <Payments />
        </TabsContent>
        <TabsContent value="statements">
          <Statements />
        </TabsContent>
      </Tabs>
    </LabPortalLayout>
  )
}

function Paged<T>({
  q,
  page,
  limit,
  setPage,
  setLimit,
  empty,
  children,
}: {
  q: ReturnType<typeof usePortalList<T>>
  page: number
  limit: number
  setPage: (p: number) => void
  setLimit: (l: number) => void
  empty: string
  children: (rows: T[]) => React.ReactNode
}) {
  if (q.isLoading) return <LoadingSkeleton variant="table" />
  if (q.isError || !q.data)
    return <ErrorState onRetry={() => void q.refetch()} />
  if (!q.data.data.length)
    return (
      <EmptyState icon={Receipt} title="Nothing here yet" description={empty} />
    )
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
        {children(q.data.data)}
      </div>
      <Pagination
        page={page}
        totalPages={Math.max(1, q.data.totalPages)}
        limit={limit}
        total={q.data.total}
        onPageChange={setPage}
        onLimitChange={(l) => {
          setLimit(l)
          setPage(1)
        }}
        pageSizeOptions={[10, 20, 50]}
      />
    </div>
  )
}

function Bills() {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [openId, setOpenId] = useState<string | null>(null)
  const q = usePortalList<VendorBill>('bills', page, limit)
  return (
    <>
      <Paged
        q={q}
        page={page}
        limit={limit}
        setPage={setPage}
        setLimit={setLimit}
        empty="Bills appear once a clinic approves them."
      >
        {(rows) => (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={th}>Bill</th>
                <th className={th}>Clinic</th>
                <th className={th}>Status</th>
                <th className={th}>Due</th>
                <th className={`${th} text-right`}>Total</th>
                <th className={`${th} text-right`}>Balance</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr
                  key={b.id}
                  className="border-t border-border/60 transition-colors hover:bg-muted/40"
                >
                  <td className={td}>
                    <p className="font-medium">{b.billNo}</p>
                    <p className="text-xs text-text-3">
                      {b.orderNo ?? ''}
                      {b.vendorInvoiceNo ? ` · ${b.vendorInvoiceNo}` : ''}
                    </p>
                  </td>
                  <td className={td}>{b.clinicName}</td>
                  <td className={td}>
                    <BillStatusBadge status={b.status} />
                  </td>
                  <td className={td}>{b.dueOn ?? '—'}</td>
                  <td className={`${td} text-right tabular-nums`}>
                    {formatPaisa(b.totalPaisa)}
                  </td>
                  <td className={`${td} text-right tabular-nums`}>
                    {formatPaisa(b.balancePaisa)}
                  </td>
                  <td className={td}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setOpenId(b.id)}
                    >
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Paged>
      <BillSheet id={openId} onClose={() => setOpenId(null)} />
    </>
  )
}

function BillSheet({
  id,
  onClose,
}: {
  id: string | null
  onClose: () => void
}) {
  const { labId } = useActiveLab()
  const q = useQuery({
    queryKey: [...labPortalKeys.all, labId, 'payables', 'bill', id],
    queryFn: () => labBillingApi.bill(id as string),
    enabled: !!id && !!labId,
  })
  const b = q.data
  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{b ? `Bill ${b.billNo}` : 'Bill'}</SheetTitle>
          <SheetDescription>
            {b ? `${b.clinicName ?? ''} · ${b.billDate}` : ''}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6">
          {q.isLoading ? (
            <LoadingSkeleton variant="detail" />
          ) : q.isError || !b ? (
            <ErrorState onRetry={() => void q.refetch()} />
          ) : (
            <>
              <ul className="divide-y divide-border/60 text-sm">
                {b.lines.map((l) => (
                  <li key={l.id} className="flex justify-between gap-3 py-2">
                    <span>
                      <span className="text-xs text-text-3">
                        {LINE_KIND_LABEL[l.lineKind]} ·{' '}
                      </span>
                      {l.description} × {l.quantity}
                    </span>
                    <span className="tabular-nums">
                      {formatPaisa(l.lineTotalPaisa)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="space-y-1 rounded-lg border border-border bg-muted/30 p-3 text-sm">
                <div className="flex justify-between">
                  <span>Total</span>
                  <span className="tabular-nums">
                    {formatPaisa(b.totalPaisa)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Paid</span>
                  <span className="tabular-nums">
                    {formatPaisa(b.paidPaisa)}
                  </span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Balance</span>
                  <span className="tabular-nums">
                    {formatPaisa(b.balancePaisa)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Payments() {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const q = usePortalList<VendorPayment>('payments', page, limit)
  return (
    <Paged
      q={q}
      page={page}
      limit={limit}
      setPage={setPage}
      setLimit={setLimit}
      empty="Payments clinics record for you show here."
    >
      {(rows) => (
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={th}>Payment</th>
              <th className={th}>Clinic</th>
              <th className={th}>Paid on</th>
              <th className={th}>Method</th>
              <th className={`${th} text-right`}>Amount</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr
                key={p.id}
                className="border-t border-border/60 transition-colors hover:bg-muted/40"
              >
                <td className={td}>
                  <p className="font-medium">{p.paymentNo}</p>
                  <p className="text-xs text-text-3">
                    {(p.allocations ?? []).map((a) => a.billNo).join(', ')}
                  </p>
                </td>
                <td className={td}>{p.clinicName}</td>
                <td className={td}>{p.paidOn}</td>
                <td className={td}>{METHOD_LABEL[p.method]}</td>
                <td className={`${td} text-right tabular-nums`}>
                  {formatPaisa(p.amountPaisa)}
                </td>
                <td className={td}>
                  <StatusBadge
                    status={p.status}
                    tone={p.status === 'posted' ? 'success' : 'muted'}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Paged>
  )
}

function Statements() {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const q = usePortalList<LabStatement>('statements', page, limit)
  return (
    <Paged
      q={q}
      page={page}
      limit={limit}
      setPage={setPage}
      setLimit={setLimit}
      empty="Statements a clinic reconciles against your work show here."
    >
      {(rows) => (
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={th}>Period</th>
              <th className={th}>Clinic</th>
              <th className={th}>Ref.</th>
              <th className={`${th} text-right`}>Total</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr
                key={s.id}
                className="border-t border-border/60 transition-colors hover:bg-muted/40"
              >
                <td className={td}>
                  {s.periodStart} – {s.periodEnd}
                </td>
                <td className={td}>{s.clinicName}</td>
                <td className={td}>{s.statementRef ?? '—'}</td>
                <td className={`${td} text-right tabular-nums`}>
                  {formatPaisa(s.totalPaisa)}
                </td>
                <td className={td}>
                  <StatementStatusBadge status={s.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Paged>
  )
}
