import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  downloadPayrollCsv,
  markPayrollOnHold,
  openPayslipPdf,
} from '../services/payroll.api'
import { LOCATION_PAYROLL_KEY } from './useLocationPayroll'
import { PAYROLL_KEY } from './useEmployeePayroll'

const errorOf = (err: any, fallback: string) =>
  err?.response?.data?.message || err?.message || fallback

export function useMarkPayrollOnHold() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (recordId: string) => markPayrollOnHold(recordId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LOCATION_PAYROLL_KEY] })
      queryClient.invalidateQueries({ queryKey: [PAYROLL_KEY] })
      toast.success('Payroll put on hold')
    },
    onError: (err: any) =>
      toast.error(errorOf(err, 'Could not put the record on hold')),
  })
}

export function useExportPayrollCsv() {
  return useMutation({
    mutationFn: (v: { month: number; year: number }) =>
      downloadPayrollCsv(v.month, v.year),
    onError: (err: any) =>
      toast.error(errorOf(err, 'Could not export payroll')),
  })
}

export function usePayslipPdf() {
  return useMutation({
    mutationFn: (recordId: string) => openPayslipPdf(recordId),
    onError: (err: any) =>
      toast.error(errorOf(err, 'Could not open the payslip')),
  })
}
