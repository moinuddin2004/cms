import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import {
  ArrowLeft,
  ArrowRight,
  HeartPulse,
  Moon,
  Stethoscope,
  Sun,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  I18nManager,
  Pressable,
  ScrollView,
  useColorScheme,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';

import { BrandMark, PRODUCT_NAME } from '@/core/components/brand/BrandMark';
import { env } from '@/core/env';
import {
  setLocale,
  translate,
  UrduFontScope,
  type Locale,
  type MessageKey,
} from '@/core/i18n';
import { switchSpace } from '@/core/space/switch-space';
import { markReady } from '@/core/splash';
import { getPref } from '@/core/storage/prefs';
import { useThemePreference } from '@/core/theme/theme-preference';
import { Button } from '@/core/ui/button';
import { Icon } from '@/core/ui/icon';
import { Text } from '@/core/ui/text';
import { cn } from '@/core/utils';

import { ClinicScene, HeroBackground, MedicineScene, TokenScene, ToothScene } from './welcome/WelcomeArt';

/** Each language in its own script — the same in both catalogs, so it stays outside `t()`. */
const LANGUAGES: { value: Locale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ur', label: 'اردو' },
];

interface Slide {
  art: ComponentType<{ size: number }>;
  title: MessageKey;
  body: MessageKey;
}

const SLIDES: Slide[] = [
  { art: ToothScene, title: 'shell.welcome.slide1Title', body: 'shell.welcome.slide1Body' },
  { art: TokenScene, title: 'shell.welcome.slide2Title', body: 'shell.welcome.slide2Body' },
  { art: MedicineScene, title: 'shell.welcome.slide3Title', body: 'shell.welcome.slide3Body' },
  { art: ClinicScene, title: 'shell.welcome.slide4Title', body: 'shell.welcome.slide4Body' },
];

/** Auto-advance pace of the hero pictures. */
const SLIDE_MS = 4500;

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

interface ChoiceButtonProps {
  icon: LucideIcon;
  title: string;
  description: string;
  primary?: boolean;
  onPress: () => void;
}

/** One of the two big choices (docs/06 X-01): reads as "title, description" to a screen reader. */
function ChoiceButton({ icon, title, description, primary, onPress }: ChoiceButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={description}
      onPress={onPress}
      className={cn(
        'min-h-16 flex-row items-center gap-3 rounded-2xl px-4 py-3',
        primary
          ? 'bg-primary active:bg-primary/90 shadow-md shadow-black/15'
          : 'border-border bg-card active:bg-accent border',
      )}>
      <View
        className={cn(
          'size-11 items-center justify-center rounded-xl',
          primary ? 'bg-primary-foreground/15' : 'bg-primary/10',
        )}>
        <Icon as={icon} className={cn('size-6', primary ? 'text-primary-foreground' : 'text-primary')} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text
          className={cn(
            'text-start text-base font-semibold',
            primary ? 'text-primary-foreground' : 'text-foreground',
          )}>
          {title}
        </Text>
        <Text
          numberOfLines={2}
          className={cn(
            'text-start text-xs',
            primary ? 'text-primary-foreground/80' : 'text-muted-foreground',
          )}>
          {description}
        </Text>
      </View>
      <Icon
        as={I18nManager.isRTL ? ArrowLeft : ArrowRight}
        className={cn('size-5', primary ? 'text-primary-foreground' : 'text-muted-foreground')}
      />
    </Pressable>
  );
}

/** EN | اردو pill on the blue hero. */
function LanguagePill({
  value,
  label,
  onChange,
}: {
  value: Locale;
  label: string;
  onChange: (locale: Locale) => void;
}) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      className="flex-row rounded-full bg-white/15 p-1">
      {LANGUAGES.map((lang) => {
        const selected = lang.value === value;
        return (
          <Pressable
            key={lang.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => !selected && onChange(lang.value)}
            className={cn(
              'min-h-9 items-center justify-center rounded-full px-3',
              selected && 'bg-white',
            )}>
            <Text
              className={cn(
                'text-sm font-semibold',
                selected ? 'text-blue-700' : 'text-white',
              )}>
              {lang.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * X-01 welcome (docs/06), shown while no space is chosen (`activeSpace == null`,
 * see `EntryRedirect`); a signed-in space skips it. The brand moment of A-25:
 * the MedTrackr mark and name appear here and nowhere else in the app.
 *
 * Full-screen: a blue hero with swipeable pictures (care, live token,
 * reminders, the clinic) over a bottom panel with the two choices. The hero
 * keeps its colours in both themes; the panel follows light / dark, which the
 * sun / moon button switches (the person's own app-wide choice).
 *
 * Never guesses the space from an email (enumeration risk). The language toggle
 * sets the patient-space language; the staff choice always stays English
 * because the staff space is English-only (A-12).
 */
export function WelcomePage() {
  // Local state: `setLocale` may not change the global locale (a phone already in Urdu), yet the page must switch.
  const [locale, setPageLocale] = useState<Locale>(welcomeLocale);
  const t = (key: MessageKey, params?: Record<string, string | number>) =>
    translate(key, params, locale);
  const en = (key: MessageKey) => translate(key, undefined, 'en');

  const { width, height } = useWindowDimensions();
  const scheme = useColorScheme();
  const setThemePreference = useThemePreference((s) => s.setPreference);
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [paused, setPaused] = useState(false);
  const scroller = useRef<ScrollViewInstance>(null);

  // Picture size: generous on tall phones, never crowding the choices on short ones.
  const artSize = Math.min(width * 0.68, height * 0.3, 300);

  useEffect(() => {
    markReady();
  }, []);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => alive && setReduceMotion(on))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  // Auto-advance (off for reduced motion, after a manual swipe, and in RTL where paging offsets mirror).
  useEffect(() => {
    if (reduceMotion || paused || I18nManager.isRTL) return;
    const timer = setTimeout(() => {
      const next = (index + 1) % SLIDES.length;
      scroller.current?.scrollTo({ x: next * width, animated: true });
      setIndex(next);
    }, SLIDE_MS);
    return () => clearTimeout(timer);
  }, [index, paused, reduceMotion, width]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / Math.max(width, 1));
    if (next !== index && next >= 0 && next < SLIDES.length) setIndex(next);
  };

  const goTo = (i: number) => {
    setPaused(true);
    scroller.current?.scrollTo({ x: i * width, animated: !reduceMotion });
    setIndex(i);
  };

  const isDark = scheme === 'dark';

  return (
    <View className="bg-background flex-1">
      {/* Light icons over the blue hero, whatever the theme. */}
      <StatusBar style="light" />

      {/* ---------- Hero ---------- */}
      <View className="flex-1 overflow-hidden">
        <HeroBackground />

        <View className="pt-safe-offset-2 flex-row items-center justify-between gap-3 px-5">
          <View className="flex-row items-center gap-2">
            <BrandMark size={36} />
            <Text accessibilityRole="header" className="text-xl font-bold tracking-tight text-white">
              {PRODUCT_NAME}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <LanguagePill
              value={locale}
              label={t('shell.welcome.language')}
              onChange={(value) => {
                setLocale(value);
                setPageLocale(value);
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isDark ? t('shell.welcome.lightMode') : t('shell.welcome.darkMode')}
              onPress={() => setThemePreference(isDark ? 'light' : 'dark')}
              className="size-11 items-center justify-center rounded-full bg-white/15 active:bg-white/25">
              <Icon as={isDark ? Sun : Moon} className="size-5 text-white" />
            </Pressable>
          </View>
        </View>

        <ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScrollBeginDrag={() => setPaused(true)}
          onMomentumScrollEnd={onScrollEnd}
          className="flex-1">
          {SLIDES.map(({ art: Art, title, body }, i) => (
            <View
              key={title}
              accessible
              accessibilityLabel={`${t(title)}. ${t(body)}`}
              importantForAccessibility={i === index ? 'yes' : 'no-hide-descendants'}
              className="items-center justify-center gap-4 px-8"
              // Each page is one screen wide: the only size the paging ScrollView needs.
              style={{ width }}>
              <Art size={artSize} />
              <UrduText locale={locale}>
                <View className="items-center gap-2">
                  <Text className="text-center text-2xl font-bold tracking-tight text-white">
                    {t(title)}
                  </Text>
                  <Text className="max-w-xs text-center text-base text-white/80">{t(body)}</Text>
                </View>
              </UrduText>
            </View>
          ))}
        </ScrollView>

        {/* Page dots (tappable, 44 pt hit area). */}
        <View className="flex-row items-center justify-center pb-10">
          {SLIDES.map((slide, i) => (
            <Pressable
              key={slide.title}
              accessibilityRole="button"
              accessibilityLabel={t('shell.welcome.goToSlide', { n: i + 1 })}
              accessibilityState={{ selected: i === index }}
              hitSlop={8}
              onPress={() => goTo(i)}
              className="size-7 items-center justify-center">
              <View
                className={cn(
                  'h-2 rounded-full',
                  i === index ? 'w-6 bg-white' : 'w-2 bg-white/40',
                )}
              />
            </Pressable>
          ))}
        </View>
      </View>

      {/* ---------- Choices panel ---------- */}
      <View
        className="bg-background pb-safe-offset-3 -mt-7 gap-4 rounded-t-[32px] px-5 pt-6">
        <UrduText locale={locale}>
          <View className="gap-1">
            <Text className="text-start text-xl font-bold tracking-tight">
              {t('shell.welcome.choose')}
            </Text>
            <Text variant="muted" className="text-start">
              {t('shell.welcome.tagline')}
            </Text>
          </View>
          <ChoiceButton
            primary
            icon={HeartPulse}
            title={t('shell.welcome.patient')}
            description={t('shell.welcome.patientHint')}
            onPress={() => switchSpace('patient')}
          />
        </UrduText>
        <ChoiceButton
          icon={Stethoscope}
          title={en('shell.welcome.staff')}
          description={en('shell.welcome.staffHint')}
          onPress={() => switchSpace('staff')}
        />

        {env.webUrl ? (
          <UrduText locale={locale}>
            <View className="flex-row flex-wrap items-center justify-center">
              <Button
                variant="link"
                size="sm"
                className="min-h-11"
                accessibilityRole="link"
                onPress={() => openWebPage('/privacy')}>
                <Text className="text-muted-foreground text-xs">{t('shell.welcome.privacy')}</Text>
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
                <Text className="text-muted-foreground text-xs">{t('shell.welcome.terms')}</Text>
              </Button>
            </View>
          </UrduText>
        ) : null}
      </View>
    </View>
  );
}
