import { useForm, useStore } from '@tanstack/react-form';

import { toCreatePatientInput } from '../lib/quick-register-input';
import { quickRegisterSchema, type QuickRegisterValues } from '../schemas/quick-register.schema';
import type { PatientDetail } from '../types/patients.types';
import { useQuickRegister } from './useQuickRegister';

const defaultValues: QuickRegisterValues = {
  fullName: '',
  phone: '',
  gender: '',
  dob: '',
  isMinor: false,
  guardianName: '',
  guardianPhone: '',
  guardianRelation: '',
};

/**
 * Quick-register form (S-04b): schema wired as validators, submit runs the
 * mutation, then resets and reports the new patient. A failed submit keeps the
 * values (the mutation toasts the error). `isDirty` drives "Discard changes?".
 */
export function useQuickRegisterForm(onCreated?: (patient: PatientDetail) => void) {
  const register = useQuickRegister();

  const form = useForm({
    defaultValues,
    validators: { onChange: quickRegisterSchema, onSubmit: quickRegisterSchema },
    onSubmit: async ({ value, formApi }) => {
      let patient: PatientDetail;
      try {
        patient = await register.mutateAsync(toCreatePatientInput(value));
      } catch {
        return; // already toasted by useQuickRegister
      }
      formApi.reset();
      onCreated?.(patient);
    },
  });

  const isDirty = useStore(form.store, (s) => s.isDirty);
  return { form, isDirty };
}
