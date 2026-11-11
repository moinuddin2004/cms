import { ActivityIndicator } from 'react-native';

/** Literal class strings so Tailwind sees them. */
const TONES = {
  foreground: 'accent-foreground',
  'primary-foreground': 'accent-primary-foreground',
  'destructive-foreground': 'accent-destructive-foreground',
} as const;

export interface SpinnerProps {
  /** Token of the surface it sits on, so it stays visible in light and dark. */
  tone?: keyof typeof TONES;
}

/** Small activity indicator coloured from a foreground token. */
export function Spinner({ tone = 'foreground' }: SpinnerProps) {
  return <ActivityIndicator size="small" colorClassName={TONES[tone]} />;
}
