import { Check } from 'lucide-react-native';

import { ActionSheet } from '@/core/components';

import type { LocationOption } from '../lib/location-options';

export interface SwitchLocationSheetProps {
  open: boolean;
  onClose: () => void;
  options: LocationOption[];
  onPick: (option: LocationOption) => void;
}

/** Bottom sheet listing every clinic / location the user can work in; the current one is ticked. */
export function SwitchLocationSheet({ open, onClose, options, onPick }: SwitchLocationSheetProps) {
  return (
    <ActionSheet
      open={open}
      onClose={onClose}
      title="Switch location"
      cancelLabel="Cancel"
      actions={options.map((o) => ({
        label: o.label,
        icon: o.current ? Check : undefined,
        onPress: () => {
          if (!o.current) onPick(o);
        },
      }))}
    />
  );
}
