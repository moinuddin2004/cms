import { useForm } from '@tanstack/react-form';

import { deleteAccountSchema, type DeleteAccountFormValues } from '../schemas/delete-account.schema';

const defaultValues: DeleteAccountFormValues = { confirm: '' };

/**
 * The "type DELETE" gate. A valid submit does not delete anything: it opens the
 * final destructive confirmation (`onTyped`), so deleting always takes two
 * deliberate steps.
 */
export function useDeleteAccountForm(onTyped: () => void) {
  return useForm({
    defaultValues,
    validators: { onChange: deleteAccountSchema, onSubmit: deleteAccountSchema },
    onSubmit: () => onTyped(),
  });
}
