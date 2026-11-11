import type { ComponentProps } from 'react';

import { Input } from '@/core/ui/input';
import { cn } from '@/core/utils';

interface FormInputProps extends ComponentProps<typeof Input> {
  invalid?: boolean;
}

/** `Input` that turns red when its field has an error. */
export function FormInput({ invalid, className, ...props }: FormInputProps) {
  return <Input className={cn(invalid && 'border-destructive', className)} {...props} />;
}
