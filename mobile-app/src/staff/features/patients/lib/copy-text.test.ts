import * as Clipboard from 'expo-clipboard';

import { copyText } from './copy-text';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
const set = Clipboard.setStringAsync as jest.Mock;

describe('copyText', () => {
  beforeEach(() => set.mockReset());

  it('copies and reports success', async () => {
    set.mockResolvedValue(true);
    await expect(copyText('P-00034')).resolves.toBe(true);
    expect(set).toHaveBeenCalledWith('P-00034');
  });

  it('reports false when the clipboard refuses or throws', async () => {
    set.mockResolvedValueOnce(false);
    await expect(copyText('x')).resolves.toBe(false);
    set.mockRejectedValueOnce(new Error('denied'));
    await expect(copyText('x')).resolves.toBe(false);
  });
});
