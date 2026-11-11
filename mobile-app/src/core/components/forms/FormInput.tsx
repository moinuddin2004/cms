import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import type { ComponentProps } from 'react';
import { withUniwind } from 'uniwind';

import { useInSheet } from '@/core/components/overlays/sheet-input-context';
import { Input } from '@/core/ui/input';
import { cn } from '@/core/utils';

// Same look as `core/ui/input` (which must not be edited), native only.
const SHEET_INPUT_CLASS =
  'dark:bg-input/30 border-input bg-background text-foreground flex h-10 w-full min-w-0 flex-row items-center rounded-md border px-3 py-1 text-base leading-5 shadow-sm shadow-black/5 placeholder:text-muted-foreground/50';

const SheetInput = withUniwind(BottomSheetTextInput);

interface FormInputProps extends ComponentProps<typeof Input> {
  invalid?: boolean;
}

/**
 * `Input` that turns red when its field has an error. Inside a `FormSheet` it
 * renders `BottomSheetTextInput` so the sheet follows the keyboard.
 */
export function FormInput({ invalid, className, ...props }: FormInputProps) {
  const inSheet = useInSheet();
  const classes = cn(invalid && 'border-destructive', className);
  if (inSheet) {
    return (
      <SheetInput
        {...(props as ComponentProps<typeof SheetInput>)}
        className={cn(SHEET_INPUT_CLASS, classes)}
      />
    );
  }
  return <Input className={classes} {...props} />;
}
