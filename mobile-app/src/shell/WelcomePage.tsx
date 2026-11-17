import * as WebBrowser from 'expo-web-browser';
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { I18nManager, Pressable, ScrollView, View } from 'react-native';

import { BrandMark, PRODUCT_NAME } from '@/core/components/brand/BrandMark';
import { SegmentedControl } from '@/core/components/forms/SegmentedControl';
import { env } from '@/core/env';
import {
  setLocale,
  translate,
  UrduFontScope,
  type Locale,
  type MessageKey,
} from '@/core/i18n';
import { getPref } from '@/core/storage/prefs';
import { switchSpace } from '@/core/space/switch-space';
import { markReady } from '@/core/splash';
import { Button } from '@/core/ui/button';
import { Icon } from '@/core/ui/icon';
import { Text } from '@/core/ui/text';

/** Each language in its own script — the same in both catalogs, so it stays outside `t()`. */
const LANGUAGES: { value: Locale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ur', label: 'اردو' },
];

interface ChoiceCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  onPress: () => void;
}

/** One of the two big choices (docs/06 X-01): reads as "title, description" to a screen reader. */
function ChoiceCard({ icon, title, description, onPress }: ChoiceCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={description}
      onPress={onPress}
      className="bg-card border-border active:bg-accent min-h-11 flex-row items-center gap-4 rounded-xl border p-4">
      <View className="bg-primary/10 size-12 items-center justify-center rounded-xl">
        <Icon as={icon} className="text-primary size-6" />
      </View>
      <View className="flex-1 gap-1">
        <Text variant="large" className="text-start">
          {title}
        </Text>
        <Text variant="muted" className="text-start">
          {description}
        </Text>
      </View>
      <Icon
        as={I18nManager.isRTL ? ChevronLeft : ChevronRight}
        className="text-muted-foreground size-5"
      />
    </Pressable>
  );
}

function openWebPage(path: string): void {
  if (!env.webUrl) return;
  void WebBrowser.openBrowserAsync(`${env.webUrl}${path}`).catch(() => undefined);
}

/**
 * The language this page speaks: English until the user picks one with the
 * toggle (the `patient.language` pref). Never the phone language — staff on an
 * Urdu phone must not land on Urdu (M4-05 rework #1).
 */
function welcomeLocale(): Locale {
  return getPref('patient.language') === 'ur' ? 'ur' : 'en';
}

/** Nastaliq only around Urdu text: English inside the scope would get the Urdu font. */
function UrduText({ locale, children }: { locale: Locale; children: ReactNode }) {
  return locale === 'ur' ? <UrduFontScope>{children}</UrduFontScope> : <>{children}</>;
}

/**
 * X-01 welcome (docs/06), shown while no space is chosen (`activeSpace == null`,
 * see `EntryRedirect`); a signed-in space skips it. The brand moment of A-25:
 * the MedTrackr mark and name appear here and nowhere else in the app.
 *
 * Never guesses the space from an email (enumeration risk). The language toggle
 * sets the patient-space language; the staff choice always stays English
 * because the staff space is English-only (A-12).
 */
export function WelcomePage() {
  // Local state: `setLocale` may not change the global locale (a phone already in Urdu), yet the page must switch.
  const [locale, setPageLocale] = useState<Locale>(welcomeLocale);
  const t = (key: MessageKey) => translate(key, undefined, locale);
  const en = (key: MessageKey) => translate(key, undefined, 'en');

  useEffect(() => {
    markReady();
  }, []);

  return (
    <ScrollView
      className="bg-background flex-1"
      contentContainerClassName="flex-grow px-6 pt-safe-offset-3 pb-safe-offset-4">
      <View className="flex-row justify-end">
        <View className="w-44" accessibilityLabel={t('shell.welcome.language')}>
          <SegmentedControl
            segments={LANGUAGES}
            value={locale}
            onChange={(value) => {
              setLocale(value as Locale);
              setPageLocale(value as Locale);
            }}
          />
        </View>
      </View>

      <View className="flex-1 justify-center gap-10 py-10">
        <View className="items-center gap-4">
          <BrandMark size={72} />
          <View className="items-center gap-2">
            <Text accessibilityRole="header" className="text-center text-3xl font-bold tracking-tight">
              {PRODUCT_NAME}
            </Text>
            <UrduText locale={locale}>
              <Text variant="muted" className="max-w-xs text-center text-base">
                {t('shell.welcome.tagline')}
              </Text>
            </UrduText>
          </View>
        </View>

        <View className="gap-3">
          <UrduText locale={locale}>
            <Text variant="small" className="text-muted-foreground text-start">
              {t('shell.welcome.choose')}
            </Text>
            <ChoiceCard
              icon={Users}
              title={t('shell.welcome.patient')}
              description={t('shell.welcome.patientHint')}
              onPress={() => switchSpace('patient')}
            />
          </UrduText>
          <ChoiceCard
            icon={Building2}
            title={en('shell.welcome.staff')}
            description={en('shell.welcome.staffHint')}
            onPress={() => switchSpace('staff')}
          />
        </View>
      </View>

      {env.webUrl ? (
        <UrduText locale={locale}>
          <View className="flex-row flex-wrap items-center justify-center">
            <Button
              variant="link"
              size="sm"
              className="min-h-11"
              accessibilityRole="link"
              onPress={() => openWebPage('/privacy')}>
              <Text className="text-muted-foreground">{t('shell.welcome.privacy')}</Text>
            </Button>
            <Text variant="muted" importantForAccessibility="no">
              ·
            </Text>
            <Button
              variant="link"
              size="sm"
              className="min-h-11"
              accessibilityRole="link"
              onPress={() => openWebPage('/terms')}>
              <Text className="text-muted-foreground">{t('shell.welcome.terms')}</Text>
            </Button>
          </View>
        </UrduText>
      ) : null}
    </ScrollView>
  );
}
