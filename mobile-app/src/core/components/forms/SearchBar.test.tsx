import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { SearchBar } from './SearchBar';

describe('SearchBar', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('debounces onChange by 300 ms and only emits the last value', async () => {
    const onChange = jest.fn();
    await render(<SearchBar value="" onChange={onChange} placeholder="Search patients" />);
    const input = screen.getByLabelText('Search patients');

    await fireEvent.changeText(input, 'A');
    await act(async () => jest.advanceTimersByTime(200));
    await fireEvent.changeText(input, 'Ahm');
    await act(async () => jest.advanceTimersByTime(299));
    expect(onChange).not.toHaveBeenCalled();

    await act(async () => jest.advanceTimersByTime(1));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('Ahm');
  });

  it('clears at once through the labelled clear button', async () => {
    const onChange = jest.fn();
    await render(<SearchBar value="Ahm" onChange={onChange} placeholder="Search" clearLabel="Clear" />);
    await fireEvent.press(screen.getByLabelText('Clear'));
    expect(onChange).toHaveBeenCalledWith('');
    expect(screen.queryByLabelText('Clear')).toBeNull();
  });

  it('follows the value reset by the screen', async () => {
    const { rerender } = await render(<SearchBar value="Ahm" onChange={jest.fn()} placeholder="Search" />);
    await rerender(<SearchBar value="" onChange={jest.fn()} placeholder="Search" />);
    expect(screen.getByLabelText('Search').props.value).toBe('');
  });
});
