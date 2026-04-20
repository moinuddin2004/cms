import { createFileRoute } from '@tanstack/react-router';
import { LocationSelector } from '@/features/auth/components/LocationSelector';

export const Route = createFileRoute('/select-location')({
  component: LocationSelector,
});
