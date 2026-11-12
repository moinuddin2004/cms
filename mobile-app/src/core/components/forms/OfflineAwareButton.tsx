import type { ComponentProps } from 'react';

import { useCanMutate } from '@/core/http/use-can-mutate';
import { Button } from '@/core/ui/button';
import { Text } from '@/core/ui/text';

export type OfflineAwareButtonProps = Omit<ComponentProps<typeof Button>, 'children'> & {
  /** Label while online. */
  label: string;
};

/** A button that changes server data: disabled and labelled "Offline" without a connection (docs/02 §9). */
export function OfflineAwareButton({ label, disabled, ...props }: OfflineAwareButtonProps) {
  const canMutate = useCanMutate();
  const text = canMutate ? label : 'Offline';
  return (
    <Button {...props} disabled={disabled || !canMutate} accessibilityLabel={text}>
      <Text>{text}</Text>
    </Button>
  );
}
