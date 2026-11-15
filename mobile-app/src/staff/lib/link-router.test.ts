import { resolveStaffLink } from './link-router';

const ID = '3f2b8c1e-9d4a-4e6b-8a7c-1b2d3e4f5a6b';

describe('resolveStaffLink', () => {
  const cases: [string | null | undefined, ReturnType<typeof resolveStaffLink>][] = [
    ['/queue/doctor', { pathname: '/queue', params: { segment: 'doctor' } }],
    ['/queue/doctor/', { pathname: '/queue', params: { segment: 'doctor' } }],
    ['/queue/doctor?x=1#top', { pathname: '/queue', params: { segment: 'doctor' } }],
    ['/queue', { pathname: '/queue', params: { segment: 'board' } }],
    ['/appointments', { pathname: '/queue', params: { segment: 'board' } }],
    [`/patients/${ID}`, { pathname: `/patients/${ID}` }],
    [`/patients/${ID}?tab=rx`, { pathname: `/patients/${ID}` }],
    ['/patients/new', null],
    ['/patients/abc-123', null],
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
