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
