import { render, screen } from '@testing-library/react-native';

import { StatusBadge } from './StatusBadge';
import {
  APPOINTMENT_STATUS_TONES,
  DOSE_STATUS_TONES,
  QUEUE_STATUS_TONES,
  URGENT_BADGE,
  type StatusToneSpec,
} from './status-tones';

const ALL_SPECS: StatusToneSpec[] = [
  ...Object.values(QUEUE_STATUS_TONES),
  ...Object.values(APPOINTMENT_STATUS_TONES),
  ...Object.values(DOSE_STATUS_TONES),
  URGENT_BADGE,
];

describe('StatusBadge', () => {
  it('renders the label of every status spec (colour is never the only signal)', async () => {
    for (const spec of ALL_SPECS) {
      const { unmount } = await render(<StatusBadge {...spec} />);
      expect(screen.getByLabelText(spec.label)).toBeTruthy();
      expect(screen.getByText(spec.label)).toBeTruthy();
      await unmount();
    }
  });

  it('uses the tone token classes for a solid badge', async () => {
    await render(<StatusBadge {...URGENT_BADGE} />);
    const badge = screen.getByLabelText('Urgent');
    expect(String(badge.props.className)).toContain('bg-destructive');
    expect(String(screen.getByText('Urgent').props.className)).toContain('text-destructive-foreground');
  });

  it('draws outline badges with a tone border and soft ones with a tinted background', async () => {
    const { rerender } = await render(<StatusBadge tone="warning" label="Skipped" variant="outline" />);
    expect(String(screen.getByLabelText('Skipped').props.className)).toContain('border-warning');
    await rerender(<StatusBadge tone="success" label="Done" />);
    expect(String(screen.getByLabelText('Done').props.className)).toContain('bg-success/15');
  });
});

describe('status-tones table (docs/05 §2)', () => {
  it.each([
    ['waiting', 'neutral', undefined],
    ['called', 'info', undefined],
    ['in_consultation', 'primary', undefined],
    ['on_hold', 'warning', undefined],
    ['skipped', 'warning', 'outline'],
    ['completed', 'success', undefined],
    ['cancelled', 'destructive', 'outline'],
    ['aborted', 'destructive', 'outline'],
    ['transferred', 'neutral', 'outline'],
  ] as const)('queue %s → %s %s', (status, tone, variant) => {
    expect(QUEUE_STATUS_TONES[status].tone).toBe(tone);
    expect(QUEUE_STATUS_TONES[status].variant).toBe(variant);
  });

  it('covers every appointment and dose status with a tone', () => {
    expect(Object.keys(APPOINTMENT_STATUS_TONES)).toHaveLength(6);
    expect(DOSE_STATUS_TONES.taken.tone).toBe('success');
    expect(DOSE_STATUS_TONES.missed.tone).toBe('warning');
    expect(URGENT_BADGE.tone).toBe('destructive');
  });
});
