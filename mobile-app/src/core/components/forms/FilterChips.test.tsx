import { fireEvent, render, screen } from '@testing-library/react-native';

import { FilterChips } from './FilterChips';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
];

describe('FilterChips', () => {
  it('single select replaces the value and toggles off', async () => {
    const onChange = jest.fn();
    const { rerender } = await render(<FilterChips options={OPTIONS} value={[]} onChange={onChange} />);
    await fireEvent.press(screen.getByText('Alpha'));
    expect(onChange).toHaveBeenLastCalledWith(['a']);
    await rerender(<FilterChips options={OPTIONS} value={['a']} onChange={onChange} />);
    await fireEvent.press(screen.getByText('Beta'));
    expect(onChange).toHaveBeenLastCalledWith(['b']);
    await fireEvent.press(screen.getByText('Alpha'));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('multi select adds/removes and shows a Clear chip with the count', async () => {
    const onChange = jest.fn();
    await render(
      <FilterChips options={OPTIONS} value={['a', 'b']} onChange={onChange} multiple clearLabel="Clear" />,
    );
    expect(screen.getByLabelText('Clear (2)')).toBeTruthy();
    await fireEvent.press(screen.getByText('Alpha'));
    expect(onChange).toHaveBeenLastCalledWith(['b']);
    await fireEvent.press(screen.getByLabelText('Clear (2)'));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});
