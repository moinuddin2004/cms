import { HeartPulse } from 'lucide-react-native';
import { View } from 'react-native';

import { switchSpace } from '@/core/space/switch-space';
import { Button } from '@/core/ui/button';
import { Icon } from '@/core/ui/icon';
import { Text } from '@/core/ui/text';

/**
 * The patient space's placeholder screen until M2-06 builds it. Back returns
 * to the welcome picker without signing anything out (nothing is signed in).
 */
export function PatientPlaceholderPage() {
  return (
    <View className="bg-background flex-1 items-center justify-center gap-4 px-5 py-safe">
      <View className="bg-muted size-14 items-center justify-center rounded-full">
        <Icon as={HeartPulse} className="text-muted-foreground size-6" />
      </View>
      <Text variant="h3" className="text-center">
        Patient app is coming soon
      </Text>
      <Text variant="muted" className="text-center">
        Your records, medicines and clinic visits will live here.
      </Text>
      <Button variant="outline" size="lg" onPress={() => switchSpace(null)}>
        <Text>Back</Text>
      </Button>
    </View>
  );
}
