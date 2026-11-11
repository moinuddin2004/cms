import type { LucideIcon } from 'lucide-react-native';
import { Button, type ButtonProps } from '@/core/ui/button';
import { Icon } from '@/core/ui/icon';

import { Spinner } from './Spinner';
import { cn } from '@/core/utils';

export interface IconButtonProps
  extends Omit<ButtonProps, 'children' | 'size' | 'accessibilityLabel' | 'aria-label'> {
  icon: LucideIcon;
  /** Required: an icon alone tells a screen reader nothing (docs/04 §14). */
  accessibilityLabel: string;
  /** Shows a spinner in place of the icon and blocks presses (docs/05 §7 feedback). */
  loading?: boolean;
}

/** Icon-only pressable. 44×44 pt minimum target; always labelled. */
export function IconButton({
  icon,
  accessibilityLabel,
  variant = 'ghost',
  loading = false,
  disabled,
  className,
  ...props
}: IconButtonProps) {
  const blocked = disabled || loading;
  return (
    <Button
      variant={variant}
      size="icon"
      className={cn('size-11 min-h-11 min-w-11 rounded-full', className)}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!blocked, busy: loading }}
      disabled={blocked}
      {...props}>
      {loading ? <Spinner tone={variant === 'default' ? 'primary-foreground' : variant === 'destructive' ? 'destructive-foreground' : 'foreground'} /> : <Icon as={icon} />}
    </Button>
  );
}
