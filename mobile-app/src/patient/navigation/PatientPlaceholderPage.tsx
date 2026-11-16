import { useRouter } from 'expo-router';
import { Building2, HeartPulse, LogOut, Stethoscope, Trash2, Users } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { ConfirmDialog } from '@/core/components';
import { useT } from '@/core/i18n';
import { switchSpace } from '@/core/space/switch-space';
import { Button } from '@/core/ui/button';
import { Icon } from '@/core/ui/icon';
import { Text } from '@/core/ui/text';
import { useSignOutPatient } from '@/patient/features/auth';
import { LiveTokenSection } from '@/patient/features/queue';
import { usePatientAuthStore } from '@/patient/store/usePatientAuthStore';

/**
 * The signed-in patient home until the tab screens arrive (M2-07+). It carries
 * the two space actions that must exist from day one: switch to the staff space
 * (nothing is signed out) and sign out (wipes patient data only).
 */
export function PatientPlaceholderPage() {
  const { t } = useT();
  const email = usePatientAuthStore((s) => s.account?.email ?? '');
  const name = usePatientAuthStore((s) => s.account?.fullName);
  const [confirming, setConfirming] = useState(false);
  const signOut = useSignOutPatient();
  const router = useRouter();

  return (
    <View className="bg-background flex-1 items-center justify-center gap-4 px-5 py-safe">
      {/* Live token (M3-06). The Today screen (M3-04) pins this same component at its top. */}
      <View className="w-full">
        <LiveTokenSection />
      </View>
      <View className="bg-muted size-14 items-center justify-center rounded-full">
        <Icon as={HeartPulse} className="text-muted-foreground size-6" />
      </View>
      <Text variant="h3" className="text-center">
        {name ? t('home.greeting', { name }) : t('home.title')}
      </Text>
      <Text variant="muted" className="text-center">
        {t('home.placeholder')}
      </Text>
      {email ? (
        <Text variant="muted" className="text-center text-xs">
          {t('home.signedInAs', { email })}
        </Text>
      ) : null}

      {/* Until the tab bar lands (M2-06 follow-up), the M2-10 / M2-11 screens are reached from here. */}
      <Button variant="outline" size="lg" onPress={() => router.push('/family')}>
        <Icon as={Users} className="size-5" />
        <Text>{t('family.title')}</Text>
      </Button>
      <Button variant="outline" size="lg" onPress={() => router.push('/clinics')}>
        <Icon as={Building2} className="size-5" />
        <Text>{t('clinics.title')}</Text>
      </Button>
      <Button variant="outline" size="lg" onPress={() => switchSpace('staff')}>
        <Icon as={Stethoscope} className="size-5" />
        <Text>{t('home.switchToStaff')}</Text>
      </Button>
      <Button variant="ghost" size="lg" onPress={() => setConfirming(true)}>
        <Icon as={LogOut} className="text-destructive size-5" />
        <Text className="text-destructive">{t('common.signOut')}</Text>
      </Button>
      <Button variant="ghost" size="lg" onPress={() => router.push('/account/delete')}>
        <Icon as={Trash2} className="text-destructive size-5" />
        <Text className="text-destructive">{t('account.delete.title')}</Text>
      </Button>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t('home.signOutTitle')}
        description={t('home.signOutBody')}
        confirmLabel={t('common.signOut')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={() => signOut.mutateAsync()}
      />
    </View>
  );
}
