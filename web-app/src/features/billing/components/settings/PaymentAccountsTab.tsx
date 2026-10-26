import { useEffect, useMemo, useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { Landmark, Loader2, Pencil, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import type { ColumnDef } from '@/components/shared/table-features'
import { DataTable } from '@/components/shared/DataTable'
import { SectionHeading } from '../shared/billing-ui'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { FormSheet } from '@/components/forms/FormSheet'
import { FieldWrapper } from '@/components/forms/FieldWrapper'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { ErrorState } from '@/components/shared'
import { fieldError } from '@/features/queue/utils/fieldError'
import { useBillingMutation } from '../../hooks/use-billing-mutation'
import {
  useBillingSettings,
  usePaymentAccounts,
} from '../../hooks/use-billing-queries'
import { paymentAccountSchema } from '../../schemas/billing.schema'
import type { PaymentAccountValues } from '../../schemas/billing.schema'
import { configApi } from '../../services/billing-v2.api'
import type { PaymentAccount, PaymentMethod } from '../../types/billing.types'
import { OptionSelect } from '../shared/OptionSelect'

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank transfer',
  CARD: 'Card',
  ONLINE_WALLET: 'Online wallet',
  CHEQUE: 'Cheque',
}

const EMPTY: PaymentAccountValues = {
  name: '',
  method: 'BANK_TRANSFER',
  bankName: '',
  accountTitle: '',
  accountNumber: '',
  requiresReference: true,
  countedInCashClose: false,
  sortOrder: 0,
}

/** Payment accounts of the location: Cash, Meezan Bank, JazzCash… (D20). */
const activeSwitch = (
  label: string,
  checked: boolean,
  onChange: () => void,
  tip: string,
) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Switch
            size="sm"
            checked={checked}
            onCheckedChange={onChange}
            aria-label={label}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {tip}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
)

const editButton = (tooltip: string, onClick: () => void) => (
  <div className="flex justify-end">
    <TooltipButton
      tooltip={tooltip}
      variant="ghost"
      size="sm"
      className="h-8 w-8 p-0"
      onClick={onClick}
    >
      <Pencil className="h-4 w-4 text-muted-foreground" />
    </TooltipButton>
  </div>
)

export function PaymentAccountsTab() {
  const accounts = usePaymentAccounts()
  const settings = useBillingSettings()
  const [editing, setEditing] = useState<PaymentAccount | 'new' | null>(null)
  const toggle = useBillingMutation((a: PaymentAccount) =>
    configApi.updateAccount(a.id, { isActive: !a.isActive }),
  )
  const defaultId = settings.data?.defaultPaymentAccountId
  const columns = useMemo<ColumnDef<PaymentAccount, unknown>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Account',
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            {row.original.name}
            {defaultId === row.original.id && (
              <Badge variant="info" className="px-1.5 py-0 text-[10px]">
                Default
              </Badge>
            )}
          </span>
        ),
      },
      {
        accessorKey: 'method',
        header: 'Kind',
        cell: ({ row }) => (
          <Badge variant="muted">{METHOD_LABEL[row.original.method]}</Badge>
        ),
      },
      {
        id: 'bank',
        header: 'Bank',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {[
              row.original.bankName,
              row.original.accountNumber &&
                `••${row.original.accountNumber.slice(-4)}`,
            ]
              .filter(Boolean)
              .join(' ') || '—'}
          </span>
        ),
      },
      {
        id: 'rules',
        header: 'Rules',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="inline-flex flex-wrap gap-1">
            {row.original.requiresReference && (
              <Badge variant="muted" className="px-1.5 py-0 text-[10px]">
                Reference
              </Badge>
            )}
            {row.original.countedInCashClose && (
              <Badge variant="muted" className="px-1.5 py-0 text-[10px]">
                Cash count
              </Badge>
            )}
          </span>
        ),
      },
      {
        id: 'active',
        header: 'Active',
        enableSorting: false,
        cell: ({ row }) =>
          activeSwitch(
            `${row.original.isActive ? 'Deactivate' : 'Activate'} ${row.original.name}`,
            row.original.isActive,
            () => toggle.mutate(row.original),
            row.original.isActive
              ? 'In use — click to deactivate'
              : 'Inactive — click to activate',
          ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) =>
          editButton('Edit account', () => setEditing(row.original)),
      },
    ],
    [defaultId, toggle],
  )

  return (
    <section className="space-y-2">
      <SectionHeading
        icon={Landmark}
        title="Payment accounts"
        description="Where this location receives money: Cash, bank, card machine, wallets"
        actions={
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="size-3.5" /> Add account
          </Button>
        }
      />
      {accounts.isError ? (
        <ErrorState onRetry={() => void accounts.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={accounts.data ?? []}
          isLoading={accounts.isLoading}
          pagination={false}
        />
      )}
      <AccountSheet account={editing} onClose={() => setEditing(null)} />
    </section>
  )
}

function AccountSheet({
  account,
  onClose,
}: {
  account: PaymentAccount | 'new' | null
  onClose: () => void
}) {
  const isNew = account === 'new'
  const save = useBillingMutation(
    (v: PaymentAccountValues) => {
      const body = {
        ...v,
        bankName: v.bankName || null,
        accountTitle: v.accountTitle || null,
        accountNumber: v.accountNumber || null,
      }
      if (isNew || !account) return configApi.createAccount(body)
      const { method: _m, ...update } = body
      return configApi.updateAccount(account.id, update)
    },
    { success: 'Account saved' },
  )
  const form = useForm({
    defaultValues: EMPTY,
    validators: {
      onChange: paymentAccountSchema,
      onSubmit: paymentAccountSchema,
    },
    onSubmit: async ({ value }) => {
      await save.mutateAsync(value)
      onClose()
    },
  })
  useEffect(() => {
    if (!account) return
    form.reset(
      account === 'new'
        ? EMPTY
        : {
            name: account.name,
            method: account.method,
            bankName: account.bankName ?? '',
            accountTitle: account.accountTitle ?? '',
            accountNumber: account.accountNumber ?? '',
            requiresReference: account.requiresReference,
            countedInCashClose: account.countedInCashClose,
            sortOrder: account.sortOrder,
          },
    )
  }, [account, form])

  const text = (
    name: 'name' | 'bankName' | 'accountTitle' | 'accountNumber',
    label: string,
    required = false,
  ) => (
    <form.Field name={name}>
      {(f) => (
        <FieldWrapper
          label={label}
          htmlFor={`acc-${name}`}
          required={required}
          error={fieldError(f)}
        >
          <Input
            id={`acc-${name}`}
            value={f.state.value}
            onChange={(e) => f.handleChange(e.target.value)}
            onBlur={f.handleBlur}
          />
        </FieldWrapper>
      )}
    </form.Field>
  )
  const toggleField = (
    name: 'requiresReference' | 'countedInCashClose',
    label: string,
  ) => (
    <form.Field name={name}>
      {(f) => (
        <label className="flex items-center justify-between gap-3 text-sm">
          {label}
          <Switch
            checked={f.state.value}
            onCheckedChange={f.handleChange}
            aria-label={label}
          />
        </label>
      )}
    </form.Field>
  )

  return (
    <FormSheet
      open={!!account}
      onOpenChange={(o) => !o && onClose()}
      title={isNew ? 'Add payment account' : 'Edit payment account'}
      description="Old receipts keep the account name they were taken with."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <form.Subscribe
            selector={(s) => [s.canSubmit, s.isSubmitting] as const}
          >
            {([canSubmit, isSubmitting]) => (
              <Button
                onClick={() => void form.handleSubmit()}
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}{' '}
                Save
              </Button>
            )}
          </form.Subscribe>
        </>
      }
    >
      <div className="space-y-4">
        {text('name', 'Name', true)}
        <form.Field name="method">
          {(f) => (
            <FieldWrapper
              label="Kind"
              hint={isNew ? undefined : 'The kind cannot change once created.'}
            >
              <OptionSelect
                disabled={!isNew}
                options={Object.entries(METHOD_LABEL).map(([value, label]) => ({
                  value,
                  label,
                }))}
                value={f.state.value}
                onChange={(v) => {
                  f.handleChange(v as PaymentMethod)
                  form.setFieldValue('requiresReference', v !== 'CASH')
                  form.setFieldValue('countedInCashClose', v === 'CASH')
                }}
              />
            </FieldWrapper>
          )}
        </form.Field>
        {text('bankName', 'Bank name')}
        {text('accountTitle', 'Account title')}
        {text('accountNumber', 'Account number')}
        {toggleField('requiresReference', 'Reference number required')}
        {toggleField('countedInCashClose', 'Count physically at cash close')}
      </div>
    </FormSheet>
  )
}
