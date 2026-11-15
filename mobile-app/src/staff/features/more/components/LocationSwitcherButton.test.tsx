import { render, screen } from '@testing-library/react-native';

import { LocationSwitcherButton } from './LocationSwitcherButton';

let mockOrgs: { id: string; name: string; locations: { id: string; name: string }[] }[] = [];

jest.mock('@/staff/store/useStaffAuthStore', () => ({
  useStaffAuthStore: (sel: (s: unknown) => unknown) =>
    sel({ accessibleOrganizations: mockOrgs, activeLocationId: 'l1' }),
  activeOrganization: () => mockOrgs[0],
}));
jest.mock('../hooks/useSwitchLocation', () => ({
  useSwitchLocation: () => ({ isPending: false, mutate: jest.fn() }),
}));
jest.mock('./SwitchLocationSheet', () => ({ SwitchLocationSheet: () => null }));
jest.mock('@/core/components', () => {
  const { Pressable } = jest.requireActual<typeof import('react-native')>('react-native');
  const R = jest.requireActual<typeof import('react')>('react');
  return {
    IconButton: ({ accessibilityLabel }: { accessibilityLabel: string }) =>
      R.createElement(Pressable, { accessibilityLabel }),
  };
});

describe('LocationSwitcherButton', () => {
  it('shows with two or more locations', async () => {
    mockOrgs = [
      {
        id: 'o1',
        name: 'Clinic',
        locations: [
          { id: 'l1', name: 'Main' },
          { id: 'l2', name: 'North' },
        ],
      },
    ];
    await render(<LocationSwitcherButton />);
    expect(screen.getByLabelText('Switch location')).toBeTruthy();
  });

  it('is hidden with one location', async () => {
    mockOrgs = [{ id: 'o1', name: 'Clinic', locations: [{ id: 'l1', name: 'Main' }] }];
    await render(<LocationSwitcherButton />);
    expect(screen.queryByLabelText('Switch location')).toBeNull();
  });
});
