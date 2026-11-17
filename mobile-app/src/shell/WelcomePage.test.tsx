import { fireEvent, render, screen } from '@testing-library/react-native';
import { getLocales } from 'expo-localization';

import { en } from '@/core/i18n/en';
import { setLocale } from '@/core/i18n';
import { ur } from '@/core/i18n/ur';
import { switchSpace } from '@/core/space/switch-space';
import { getPref } from '@/core/storage/prefs';

import { WelcomePage } from './WelcomePage';

jest.mock('expo-localization', () => ({ getLocales: jest.fn(() => [{ languageCode: 'en' }]) }));
jest.mock('@/core/space/switch-space', () => ({ switchSpace: jest.fn() }));
jest.mock('@/core/splash', () => ({ markReady: jest.fn() }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/core/env', () => ({ env: { apiUrl: 'http://api.test', webUrl: 'https://web.test' } }));

const welcome = { en: en.shell.welcome, ur: ur.shell.welcome };

describe('WelcomePage', () => {
  afterEach(() => {
    setLocale(null);
    (getLocales as jest.Mock).mockReturnValue([{ languageCode: 'en' }]);
    (switchSpace as jest.Mock).mockClear();
  });

  it('shows the brand name and both choices', async () => {
    await render(<WelcomePage />);

    expect(screen.getByText('MedTrackr')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(welcome.en.patient));
    expect(switchSpace).toHaveBeenCalledWith('patient');
    await fireEvent.press(screen.getByLabelText(welcome.en.staff));
    expect(switchSpace).toHaveBeenCalledWith('staff');
  });

  it('stays English on an Urdu phone until Urdu is picked', async () => {
    (getLocales as jest.Mock).mockReturnValue([{ languageCode: 'ur' }]);
    setLocale(null);

    await render(<WelcomePage />);
    expect(screen.getByText(welcome.en.tagline)).toBeTruthy();

    await fireEvent.press(screen.getByText('اردو'));

    expect(getPref('patient.language')).toBe('ur');
    expect(screen.getByText(welcome.ur.tagline)).toBeTruthy();
    expect(screen.getByLabelText(welcome.ur.patient)).toBeTruthy();
    // The staff space is English-only (A-12), so its choice never switches.
    expect(screen.getByLabelText(welcome.en.staff)).toBeTruthy();
  });

  it('opens the web privacy policy', async () => {
    const { openBrowserAsync } = jest.requireMock('expo-web-browser');
    await render(<WelcomePage />);

    await fireEvent.press(screen.getByText(welcome.en.privacy));

    expect(openBrowserAsync).toHaveBeenCalledWith('https://web.test/privacy');
  });
});
