export interface AppLinkStatus {
  status: 'none' | 'active';
  link: {
    id: string;
    linkedAt: string;
    maskedEmail: string | null;
    relation: string;
    linkMethod: string;
  } | null;
  pendingClaim: { expiresAt: string } | null;
}

/** `POST /patients/:id/app-link/claim-token`. The raw token is returned only here (docs/07 §4.1). */
export interface ClaimTokenResult {
  token: string;
  url: string;
  expiresAt: string;
}

/** The result plus the phone-clock deadline worked out from the server's time (see `countdown.ts`). */
export interface IssuedClaim extends ClaimTokenResult {
  deadlineMs: number;
}
