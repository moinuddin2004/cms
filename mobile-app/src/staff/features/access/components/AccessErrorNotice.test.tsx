import { fireEvent, render, screen } from '@testing-library/react-native';

import { AccessErrorBanner, AccessErrorState } from './AccessErrorNotice';

const mockRefetch = jest.fn();
let mockStatus = 'error';

jest.mock('./AccessProvider', () => ({
  useAccess: () => ({ status: mockStatus, refetch: mockRefetch }),
}));

describe('access error notices', () => {
  beforeEach(() => {
    mockRefetch.mockClear();
    mockStatus = 'error';
  });

  it('banner retries /me/access', async () => {
    await render(<AccessErrorBanner />);
    expect(screen.getByText('Could not load your permissions')).toBeTruthy();
    await fireEvent.press(screen.getByText('Retry'));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('full state retries /me/access', async () => {
    await render(<AccessErrorState />);
    await fireEvent.press(screen.getByText('Try again'));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('render nothing unless access failed', async () => {
    mockStatus = 'ready';
    await render(
      <>
        <AccessErrorBanner />
        <AccessErrorState />
      </>,
    );
    expect(screen.queryByText('Could not load your permissions')).toBeNull();
  });
});
