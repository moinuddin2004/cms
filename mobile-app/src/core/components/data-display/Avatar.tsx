import { Image } from 'expo-image';
import { useState } from 'react';

import { Avatar as UiAvatar, AvatarFallback } from '@/core/ui/avatar';
import { Text } from '@/core/ui/text';
import { cn } from '@/core/utils';

import { AVATAR_TINTS, avatarTintIndex, initialsOf } from './avatar-tint';

export interface AvatarProps {
  /** Person or clinic name — gives the initials and the default tint. */
  name: string;
  imageUrl?: string | null;
  /** 0–7 palette index; default is derived from `name`. */
  tint?: number;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE = { sm: 'size-8', md: 'size-10', lg: 'size-14' } as const;
const INITIALS = { sm: 'text-xs', md: 'text-sm', lg: 'text-lg' } as const;

/** Person or clinic: image when it loads, otherwise initials on a stable tint. */
export function Avatar({ name, imageUrl, tint, size = 'md' }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const index = (tint ?? avatarTintIndex(name)) % AVATAR_TINTS.length;

  return (
    <UiAvatar alt={name} className={SIZE[size]}>
      <AvatarFallback className={AVATAR_TINTS[index]}>
        <Text className={cn('font-semibold', INITIALS[size])}>{initialsOf(name)}</Text>
      </AvatarFallback>
      {imageUrl && !failed ? (
        <Image
          source={{ uri: imageUrl }}
          accessibilityIgnoresInvertColors
          contentFit="cover"
          className="absolute inset-0"
          onError={() => setFailed(true)}
        />
      ) : null}
    </UiAvatar>
  );
}
