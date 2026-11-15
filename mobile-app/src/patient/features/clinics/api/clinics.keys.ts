/** Root is `links`: the patient client invalidates `['links']` when a link goes read-only. */
export const linkKeys = {
  all: ['links'] as const,
  list: () => ['links', 'list'] as const,
  history: (linkId: string) => ['links', 'history', linkId] as const,
};
