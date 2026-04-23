import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMarkPaid } from '@/hooks/usePayroll';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

const markPaidSchema = z.object({
  paymentMethod: z.enum(['cash', 'bank_transfer', 'cheque']),
  paymentReference: z.string().optional(),
  notes: z.string().optional(),
});

type MarkPaidFormValues = z.infer<typeof markPaidSchema>;

interface MarkPaidModalProps {
  record: {
    id: string;
    employeeId: string;
    periodLabel: string;
    salaryAmount: number;
  } | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MarkPaidModal({
  record,
  isOpen,
  onOpenChange,
}: MarkPaidModalProps) {
  const markPaidMutation = useMarkPaid();

  const form = useForm<MarkPaidFormValues>({
    resolver: zodResolver(markPaidSchema),
    defaultValues: {
      paymentMethod: 'bank_transfer',
      paymentReference: '',
      notes: '',
    },
  });

  const watchPaymentMethod = form.watch('paymentMethod');

  async function onSubmit(data: MarkPaidFormValues) {
    if (!record) return;
    try {
      await markPaidMutation.mutateAsync({
        recordId: record.id,
        employeeId: record.employeeId,
        data,
      });
      toast.success('✅ Salary marked as paid');
      onOpenChange(false);
      form.reset();
    } catch (error) {
      toast.error('Failed to mark as paid');
    }
  }

  if (!record) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Mark Salary as Paid</DialogTitle>
          <DialogDescription>
            {record.periodLabel} · {formatCurrency(record.salaryAmount)}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Method</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {watchPaymentMethod === 'bank_transfer' && (
              <FormField
                control={form.control}
                name="paymentReference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Transaction ID or reference" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Any additional notes" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={markPaidMutation.isPending}>
                {markPaidMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Payment
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
