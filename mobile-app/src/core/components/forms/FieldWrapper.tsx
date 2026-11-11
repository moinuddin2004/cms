import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Label } from '@/core/ui/label';
import { Text } from '@/core/ui/text';
import { cn } from '@/core/utils';

interface FieldWrapperProps {
  label?: string;
  required?: boolean;
  error?: ReactNode;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Label + control + error wrapper used by every form field. */
export function FieldWrapper({ label, required, error, hint, className, children }: FieldWrapperProps) {
  return (
    <View className={cn('gap-1.5', className)}>
      {label ? (
        <Label>
          {label}
          {required ? <Text className="text-destructive"> *</Text> : null}
        </Label>
      ) : null}
      {children}
      {error ? (
        <Text className="text-destructive text-xs font-medium">{error}</Text>
      ) : hint ? (
        <Text variant="muted" className="text-xs">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
