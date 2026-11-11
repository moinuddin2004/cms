import { fireEvent, render, screen } from '@testing-library/react-native';
import { Bell } from 'lucide-react-native';

import { IconButton } from './IconButton';

describe('IconButton', () => {
  it('exposes its accessibility label and fires onPress', async () => {
    const onPress = jest.fn();
    await render(<IconButton icon={Bell} accessibilityLabel="Notifications" onPress={onPress} />);
    await fireEvent.press(screen.getByLabelText('Notifications'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire while loading', async () => {
    const onPress = jest.fn();
    await render(<IconButton icon={Bell} accessibilityLabel="Notifications" loading onPress={onPress} />);
    await fireEvent.press(screen.getByLabelText('Notifications'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('requires accessibilityLabel at the type level', async () => {
    // @ts-expect-error — an icon-only control without a label must not compile (docs/04 §14).
    const missing = <IconButton icon={Bell} />;
    expect(missing).toBeTruthy();
  });
});
