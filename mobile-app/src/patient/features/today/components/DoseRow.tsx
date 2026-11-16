import { Check, MoreHorizontal, SkipForward } from 'lucide-react-native';
import { View } from 'react-native';

import { Avatar, IconButton } from '@/core/components';
import { useT } from '@/core/i18n';
import { mealLabel } from '@/patient/features/medications';
import { Button } from '@/core/ui/button';
import { Icon } from '@/core/ui/icon';
import { Text } from '@/core/ui/text';

import type { TodayDose } from '../lib/today-model';

export interface DoseRowProps {
  dose: TodayDose;
  /** Family member's name when known — shows an avatar. */
  profileName: string | null;
  /** The decision is saved on the phone and not sent yet. */
  waitingToSync: boolean;
  onTaken: () => void;
  onMore: () => void;
}

/** One dose: time, medicine, dose text, meal hint, state and its actions (docs/06 P-02). */
export function DoseRow({ dose, profileName, waitingToSync, onTaken, onMore }: DoseRowProps) {
  const { t } = useT();
  const meal = mealLabel(dose.mealRelation, t);
  const detail = [dose.doseText, meal].filter(Boolean).join(' · ');
  const ends =
    dose.courseEndsInDays === null
      ? null
      : dose.courseEndsInDays === 0
        ? t('today.courseEndsToday')
        : dose.courseEndsInDays === 1
          ? t('today.courseEndsTomorrow')
          : t('today.courseEnds', { days: dose.courseEndsInDays });
  const pending = dose.state === 'pending';

  return (
    <View
      accessible
      accessibilityLabel={[dose.time, dose.name, detail, profileName].filter(Boolean).join(', ')}
      className="bg-card border-border gap-2 rounded-xl border p-3">
      <View className="flex-row items-center gap-3">
        <Text variant="large" className="w-14">
          {dose.time}
        </Text>
        {profileName ? <Avatar name={profileName} size="sm" /> : null}
        <View className="flex-1">
          <Text variant="large" className={pending ? '' : 'text-muted-foreground'}>
            {dose.name}
          </Text>
          {detail ? <Text variant="muted">{detail}</Text> : null}
        </View>
        {pending ? (
          <View className="flex-row items-center gap-1">
            <Button size="sm" className="min-h-11" onPress={onTaken} accessibilityLabel={t('today.markTaken', { medicine: dose.name })}>
              <Text>{t('today.taken')}</Text>
            </Button>
            <IconButton icon={MoreHorizontal} accessibilityLabel={t('today.more', { medicine: dose.name })} onPress={onMore} />
          </View>
        ) : (
          <View className="flex-row items-center gap-1">
            <Icon as={dose.state === 'taken' ? Check : SkipForward} className="text-muted-foreground size-4" />
            <Text variant="muted">{dose.state === 'taken' ? t('today.taken') : t('today.skipped')}</Text>
          </View>
        )}
      </View>
      {ends ? <Text className="text-primary text-xs">{ends}</Text> : null}
      {waitingToSync ? <Text variant="muted" className="text-xs">{t('today.waitingToSync')}</Text> : null}
    </View>
  );
}
