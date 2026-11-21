import { useRouter, type Href } from 'expo-router';
import {
  Bell,
  Building2,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  FileText,
  LogOut,
  Stethoscope,
  Trash2,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { I18nManager, Pressable, View } from 'react-native';

import {
  Avatar,
  ConfirmDialog,
  IconTile,
  ListRow,
  Screen,
  SegmentedControl,
  SettingsGroup,
  ThemeModePicker,
  type StatusTone,
} from '@/core/components';
import { setLocale, useT, type Locale, type MessageKey } from '@/core/i18n';
import { switchSpace } from '@/core/space/switch-space';
import { Icon } from '@/core/ui/icon';
import { Text } from '@/core/ui/text';
import { useSignOutPatient } from '@/patient/features/auth';
import { usePatientAuthStore } from '@/patient/store/usePatientAuthStore';

/** Each language in its own script — the same in both catalogs, so it stays outside `t()`. */
const LANGUAGES: { value: Locale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ur', label: 'اردو' },
];

interface Shortcut {
  href: Href;
  icon: LucideIcon;
  tone: StatusTone;
  title: MessageKey;
  hint: MessageKey;
}

const SHORTCUTS: Shortcut[] = [
  { href: '/today', icon: CalendarCheck, tone: 'primary', title: 'home.today', hint: 'home.todayHint' },
  { href: '/records', icon: FileText, tone: 'info', title: 'home.records', hint: 'home.recordsHint' },
  { href: '/family', icon: Users, tone: 'success', title: 'home.family', hint: 'home.familyHint' },
  { href: '/reminders', icon: Bell, tone: 'warning', title: 'home.reminders', hint: 'home.remindersHint' },
];

/** A 2-column quick-action card. */
function ShortcutCard({ shortcut, label, hint, onPress }: {
  shortcut: Shortcut;
  label: string;
  hint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      className="bg-card border-border active:bg-accent min-h-28 flex-1 basis-[45%] gap-3 rounded-2xl border p-4 shadow-sm shadow-black/5">
      <IconTile icon={shortcut.icon} tone={shortcut.tone} size="md" />
      <View className="gap-0.5">
        <Text className="text-start text-base font-semibold">{label}</Text>
        <Text variant="muted" numberOfLines={2} className="text-start text-xs">
          {hint}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Patient Home (P-05 "More" folded in, UI-02): a greeting card, shortcuts to
 * the main areas, then settings — appearance, language — and the account
 * actions that must always be reachable (switch to the staff space, sign out,
 * delete account).
 */
export function HomePage() {
  const { t, locale } = useT();
  const router = useRouter();
  const email = usePatientAuthStore((s) => s.account?.email ?? '');
  const name = usePatientAuthStore((s) => s.account?.fullName);
  const [confirming, setConfirming] = useState(false);
  const signOut = useSignOutPatient();
  const chevron = (
    <Icon as={I18nManager.isRTL ? ChevronLeft : ChevronRight} className="text-muted-foreground size-5" />
  );

  return (
    <Screen scroll contentClassName="gap-6 pt-4">
      {/* Greeting card on the brand colour. */}
      <View className="bg-primary overflow-hidden rounded-3xl p-5 shadow-md shadow-black/10">
        <View
          importantForAccessibility="no-hide-descendants"
          className="bg-primary-foreground/10 absolute -end-12 -top-12 size-44 rounded-full"
        />
        <View
          importantForAccessibility="no-hide-descendants"
          className="bg-primary-foreground/10 absolute -bottom-16 end-20 size-32 rounded-full"
        />
        <View className="flex-row items-center gap-4">
          <View className="border-primary-foreground/40 rounded-full border-2">
            <Avatar name={name || email || '?'} size="lg" />
          </View>
          <View className="flex-1 gap-1">
            <Text
              accessibilityRole="header"
              numberOfLines={2}
              className="text-primary-foreground text-start text-2xl font-bold">
              {name ? t('home.greeting', { name }) : t('home.title')}
            </Text>
            {email ? (
              <Text numberOfLines={1} className="text-primary-foreground/80 text-start text-sm">
                {t('home.signedInAs', { email })}
              </Text>
            ) : null}
          </View>
        </View>
        <Text className="text-primary-foreground/90 mt-4 text-start text-sm">
          {t('home.placeholder')}
        </Text>
      </View>

      <View className="gap-3">
        <Text
          accessibilityRole="header"
          className="text-muted-foreground ps-1 text-start text-xs font-semibold tracking-wider uppercase">
          {t('home.shortcuts')}
        </Text>
        <View className="flex-row flex-wrap gap-3">
          {SHORTCUTS.map((s) => (
            <ShortcutCard
              key={s.title}
              shortcut={s}
              label={t(s.title)}
              hint={t(s.hint)}
              onPress={() => router.push(s.href)}
            />
          ))}
        </View>
      </View>

      <SettingsGroup>
        <ListRow
          leading={<IconTile icon={Building2} tone="primary" />}
          title={t('home.clinics')}
          subtitle={t('home.clinicsHint')}
          trailing={chevron}
          onPress={() => router.push('/clinics')}
        />
      </SettingsGroup>

      <SettingsGroup title={t('appearance.title')} footer={t('appearance.hint')} padded>
        <ThemeModePicker
          accessibilityLabel={t('appearance.title')}
          labels={{
            light: t('appearance.light'),
            dark: t('appearance.dark'),
            system: t('appearance.system'),
          }}
        />
      </SettingsGroup>

      <SettingsGroup title={t('home.language')} padded>
        <SegmentedControl
          segments={LANGUAGES}
          value={locale}
          onChange={(value) => setLocale(value as Locale)}
        />
      </SettingsGroup>

      <SettingsGroup title={t('home.account')}>
        <ListRow
          leading={<IconTile icon={Stethoscope} tone="info" />}
          title={t('home.switchToStaff')}
          trailing={chevron}
          onPress={() => switchSpace('staff')}
        />
        <ListRow
          leading={<IconTile icon={LogOut} tone="destructive" />}
          title={t('common.signOut')}
          onPress={() => setConfirming(true)}
        />
        <ListRow
          leading={<IconTile icon={Trash2} tone="destructive" />}
          title={t('account.delete.title')}
          trailing={chevron}
          onPress={() => router.push('/account/delete')}
        />
      </SettingsGroup>

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
    </Screen>
  );
}
