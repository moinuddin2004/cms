import { LifeBuoy } from 'lucide-react-native';
import { useState } from 'react';

import { IconButton } from '@/core/components';
import { useT } from '@/core/i18n';

import { ContactSheet } from './ContactSheet';

/** Header action that opens the contact / emergency sheet (P-07). Drop it into any patient header `actions`. */
export function ContactButton() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton icon={LifeBuoy} accessibilityLabel={t('contact.open')} onPress={() => setOpen(true)} />
      <ContactSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
