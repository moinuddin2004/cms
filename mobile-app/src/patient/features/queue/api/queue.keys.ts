/** Root `queue-active` (never persisted: live data). The account id keeps accounts apart. */
export const queueKeys = {
  all: ['queue-active'] as const,
  active: (accountId: string | null) => ['queue-active', accountId] as const,
};
