import { HeartPulse, Stethoscope, Users, type LucideIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { View } from 'react-native';

import { markReady } from '@/core/splash';
import { switchSpace } from '@/core/space/switch-space';
import { Button } from '@/core/ui/button';
import { Icon } from '@/core/ui/icon';
import { Text } from '@/core/ui/text';

interface SpaceCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  onPress: () => void;
}

/** One big tap target of the picker (docs/06 X-01). */
function SpaceCard({ icon, title, description, onPress }: SpaceCardProps) {
  return (
    <Button
      variant="outline"
      className="h-auto min-h-11 items-center justify-start gap-3 p-4"
      onPress={onPress}>
      <View className="bg-muted size-10 items-center justify-center rounded-full">
        <Icon as={icon} className="text-foreground size-5" />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="font-semibold">{title}</Text>
        <Text variant="muted" className="text-muted-foreground">
          {description}
        </Text>
      </View>
    </Button>
  );
}

/**
 * X-01 welcome / space picker (docs/06). Shown when `activeSpace == null`.
 * Never guesses the space from an email (enumeration risk), and shows no
 * product name (F-05).
 */
export function WelcomePage() {
  useEffect(() => {
    markReady();
  }, []);

  return (
    <View className="bg-background flex-1 justify-center gap-8 px-5 py-safe">
      <View className="items-center gap-3">
        <View className="bg-primary/10 size-16 items-center justify-center rounded-full">
          <Icon as={HeartPulse} className="text-primary size-8" />
        </View>
        <Text variant="h2" className="border-0 pb-0 text-center">
          Your health, your clinic
        </Text>
      </View>

      <View className="gap-3">
        <SpaceCard
          icon={Users}
          title="I'm a patient"
          description="Records, medicines, token"
          onPress={() => switchSpace('patient')}
        />
        <SpaceCard
          icon={Stethoscope}
          title="I work at a clinic"
          description="Queue, patients, schedule"
          onPress={() => switchSpace('staff')}
        />
      </View>

      {/* Legal pages arrive before the store release (docs/03 §6); there is no route yet. */}
      <Text variant="muted" className="text-center">
        Privacy · Terms
      </Text>
    </View>
  );
}
