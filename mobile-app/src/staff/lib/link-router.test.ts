import { resolveStaffLink } from './link-router';

describe('resolveStaffLink', () => {
  const cases: [string | null | undefined, ReturnType<typeof resolveStaffLink>][] = [
    ['/queue/doctor', { pathname: '/queue', params: { segment: 'doctor' } }],
    ['/queue/doctor/', { pathname: '/queue', params: { segment: 'doctor' } }],
    ['/queue/doctor?x=1#top', { pathname: '/queue', params: { segment: 'doctor' } }],
    ['/queue', { pathname: '/queue', params: { segment: 'board' } }],
    ['/appointments', { pathname: '/queue', params: { segment: 'board' } }],
    ['/patients/abc-123', { pathname: '/patients/abc-123' }],
    ['/patients/abc-123?tab=rx', { pathname: '/patients/abc-123' }],
    ['/patients', null],
    ['/patients/a/b', null],
    ['/patients/../etc', null],
    ['/lab-orders/7', null],
    ['https://evil.example/queue', null],
    ['', null],
    [null, null],
    [undefined, null],
  ];
  it.each(cases)('%s', (link, expected) => {
    expect(resolveStaffLink(link)).toEqual(expected);
  });
});
