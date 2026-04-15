import { createFileRoute } from '@tanstack/react-router';
import { useNavigate } from '@tanstack/react-router';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PatientForm } from '@/features/patients/components/PatientForm';
import { useCreatePatient } from '@/features/patients/hooks/useCreatePatient';
import type { PatientFormData } from '@/features/patients/types';

export const Route = createFileRoute('/patients/new')({
  component: NewPatientPage,
});

function NewPatientPage() {
  const navigate = useNavigate();
  const createMutation = useCreatePatient();

  const handleSubmit = async (data: PatientFormData) => {
    await createMutation.mutateAsync(data);
    navigate({ to: '/patients' });
  };

  return (
    <DashboardLayout title="New Patient">
      <PatientForm
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending}
        mode="create"
      />
    </DashboardLayout>
  );
}
