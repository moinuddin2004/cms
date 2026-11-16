import { MapPin, MessageCircle, Phone, Siren } from 'lucide-react-native';
import { Linking, View } from 'react-native';
import { toast } from 'sonner-native';

import { ErrorState, LoadingSkeleton, ReadOnlySheet } from '@/core/components';
import { useT } from '@/core/i18n';
import { Button } from '@/core/ui/button';
import { Icon } from '@/core/ui/icon';
import { Text } from '@/core/ui/text';
import { useLinks } from '@/patient/features/clinics';

import { buildContacts, mapsUrl, telUrl, whatsappUrl, type ClinicContact } from '../lib/contacts';
import { emergencyNumbers } from '../lib/emergency-numbers';

async function openUrl(url: string | null, failed: string) {
  if (!url) {
    toast(failed);
    return;
  }
  try {
    await Linking.openURL(url);
  } catch {
    toast(failed); // never put the number or address in the toast
  }
}

function ContactRow({ contact, failed }: { contact: ClinicContact; failed: string }) {
  const { t } = useT();
  const name = `${contact.clinicName} · ${contact.locationName}`;
  return (
    <View className="bg-card border-border gap-3 rounded-xl border p-4">
      <View className="gap-0.5">
        <Text variant="large">{contact.clinicName}</Text>
        <Text variant="muted">{contact.locationName}</Text>
        {contact.address ? <Text className="text-sm">{contact.address}</Text> : null}
      </View>
      {contact.phone ? (
        <Button
          size="lg"
          accessibilityLabel={t('contact.callA11y', { name })}
          onPress={() => void openUrl(telUrl(contact.phone!), failed)}>
          <Icon as={Phone} className="text-primary-foreground size-5" />
          <Text>{t('contact.call')}</Text>
        </Button>
      ) : null}
      {contact.whatsapp ? (
        <Button
          size="lg"
          variant="outline"
          accessibilityLabel={t('contact.whatsappA11y', { name })}
          onPress={() => void openUrl(whatsappUrl(contact.whatsapp!), failed)}>
          <Icon as={MessageCircle} className="size-5" />
          <Text>{t('contact.whatsapp')}</Text>
        </Button>
      ) : null}
      {contact.address ? (
        <Button
          size="lg"
          variant="outline"
          accessibilityLabel={t('contact.directionsA11y', { name })}
          onPress={() => void openUrl(mapsUrl(contact.address!), failed)}>
          <Icon as={MapPin} className="size-5" />
          <Text>{t('contact.directions')}</Text>
        </Button>
      ) : null}
    </View>
  );
}

/**
 * P-07: each linked clinic's phone / WhatsApp / directions (from the location
 * on the link) plus the configurable emergency numbers. Read-only, no API writes.
 */
export function ContactSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT();
  const links = useLinks();
  const contacts = buildContacts(links.data ?? []);
  const failed = t('contact.openFailed');

  return (
    <ReadOnlySheet open={open} onClose={onClose} title={t('contact.title')} closeLabel={t('contact.close')}>
      <View className="gap-4 pb-4">
        <View className="border-destructive/40 bg-card gap-3 rounded-xl border p-4">
          <View className="flex-row items-center gap-2">
            <Icon as={Siren} className="text-destructive size-5" />
            <Text variant="large">{t('contact.emergency.title')}</Text>
          </View>
          <Text variant="muted">{t('contact.emergency.body')}</Text>
          {emergencyNumbers().map((e) => {
            const label = e.label ?? t('contact.emergency.default');
            return (
              <Button
                key={`${e.label ?? ''}:${e.number}`}
                size="lg"
                variant="destructive"
                accessibilityLabel={t('contact.callA11y', { name: label })}
                onPress={() => void openUrl(telUrl(e.number), failed)}>
                <Icon as={Phone} className="text-destructive-foreground size-5" />
                <Text>{`${label} · ${e.number}`}</Text>
              </Button>
            );
          })}
        </View>

        <Text variant="large">{t('contact.clinics')}</Text>
        {links.isPending ? (
          <LoadingSkeleton rows={2} />
        ) : links.isError ? (
          <ErrorState
            title={t('contact.loadFailed')}
            message={t('records.errorBody')}
            retryLabel={t('common.retry')}
            onRetry={() => void links.refetch()}
          />
        ) : contacts.length === 0 ? (
          <Text variant="muted">{t('contact.none')}</Text>
        ) : (
          contacts.map((c) => <ContactRow key={c.key} contact={c} failed={failed} />)
        )}
      </View>
    </ReadOnlySheet>
  );
}
