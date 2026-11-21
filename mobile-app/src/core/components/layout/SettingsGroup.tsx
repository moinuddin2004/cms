import type { LucideIcon } from 'lucide-react-native';
import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { View } from 'react-native';

import { Icon } from '@/core/ui/icon';
import { Text } from '@/core/ui/text';
import { cn } from '@/core/utils';

import type { StatusTone } from '../data-display/status-tones';

const TILE: Record<StatusTone, { bg: string; fg: string }> = {
  neutral: { bg: 'bg-muted', fg: 'text-muted-foreground' },
  primary: { bg: 'bg-primary/10', fg: 'text-primary' },
  info: { bg: 'bg-info/10', fg: 'text-info' },
  success: { bg: 'bg-success/10', fg: 'text-success' },
  warning: { bg: 'bg-warning/15', fg: 'text-warning' },
  destructive: { bg: 'bg-destructive/10', fg: 'text-destructive' },
};

export interface IconTileProps {
  icon: LucideIcon;
  tone?: StatusTone;
  /** `sm` = 36 pt (list rows), `md` = 44 pt (quick actions). */
  size?: 'sm' | 'md';
}

/** A tinted rounded square holding an icon — the leading mark of settings rows and quick actions. */
export function IconTile({ icon, tone = 'primary', size = 'sm' }: IconTileProps) {
  const t = TILE[tone];
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      className={cn(
        'items-center justify-center',
        size === 'sm' ? 'size-9 rounded-lg' : 'size-11 rounded-xl',
        t.bg,
      )}>
      <Icon as={icon} className={cn(size === 'sm' ? 'size-5' : 'size-6', t.fg)} />
    </View>
  );
}

export interface SettingsGroupProps {
  /** Small caps label above the card. */
  title?: string;
  /** Text under the card. */
  footer?: string;
  children: ReactNode;
  /** Inner padding for non-row content (e.g. a picker); rows bring their own. */
  padded?: boolean;
  className?: string;
}

/**
 * An iOS/Android-settings style group: a label and a rounded card whose rows
 * are separated by hairlines. `null` children (rows hidden by permission) are
 * skipped, so no stray divider shows.
 */
export function SettingsGroup({ title, footer, children, padded, className }: SettingsGroupProps) {
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View className={cn('gap-2', className)}>
      {title ? (
        <Text
          accessibilityRole="header"
          className="text-muted-foreground ps-1 text-xs font-semibold tracking-wider uppercase">
          {title}
        </Text>
      ) : null}
      <View
        className={cn(
          'bg-card border-border overflow-hidden rounded-2xl border shadow-sm shadow-black/5',
          padded && 'p-4',
        )}>
        {rows.map((row, i) => (
          <Fragment key={row.key ?? i}>
            {i > 0 && !padded ? <View className="bg-border ms-16 h-px" /> : null}
            {row}
          </Fragment>
        ))}
      </View>
      {footer ? <Text className="text-muted-foreground ps-1 text-xs">{footer}</Text> : null}
    </View>
  );
}
