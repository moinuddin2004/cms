import { fireEvent, render, screen } from '@testing-library/react-native';

import { SegmentedControl } from './SegmentedControl';

const SEGMENTS = [
  { value: 'mine', label: 'My queue' },
  { value: 'board', label: 'Board' },
];

describe('SegmentedControl', () => {
  it('ignores a press on the selected segment and reports a change otherwise', async () => {
    const onChange = jest.fn();
    await render(<SegmentedControl segments={SEGMENTS} value="mine" onChange={onChange} haptic={false} />);
    await fireEvent.press(screen.getByText('My queue'));
    expect(onChange).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Board'));
    expect(onChange).toHaveBeenCalledWith('board');
  });
});
