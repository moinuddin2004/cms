import { ConfigScope } from 'src/settings-registry/entities/config-value.entity';
import { defineSetting, s } from 'src/settings-registry/setting-definition';

const { ORG } = ConfigScope;

/**
 * A clinic's sign-in policy (owner edits it under Settings → Sign-in).
 * Enforced per request by ClinicGateService from the session's sign-in
 * method (`amr` claim) — see TenantContextGuard.
 */
export const SIGN_IN_POLICY_SETTINGS = {
  /** Staff may open this clinic from a Google sign-in. */
  googleEnabled: defineSetting<boolean>('auth.google_enabled', {
    schema: s.boolean(),
    default: true,
    scopes: [ORG],
    lockable: false,
  }),
  /** Password sign-ins can't open this clinic — Google only. */
  requireGoogle: defineSetting<boolean>('auth.require_google', {
    schema: s.boolean(),
    default: false,
    scopes: [ORG],
    lockable: false,
  }),
  /**
   * Google Workspace domains (`hd` claim) allowed in. Empty = any Google
   * account. Personal Gmail accounts have no `hd`, so a list here keeps
   * them out.
   */
  googleDomains: defineSetting<string[]>('auth.google_domains', {
    schema: s.domainList(),
    default: [],
    scopes: [ORG],
    lockable: false,
  }),
  /**
   * People signing in with Google from one of `googleDomains` may ask to
   * join; an owner/manager approves and picks their role.
   */
  joinRequestsEnabled: defineSetting<boolean>('auth.join_requests_enabled', {
    schema: s.boolean(),
    default: false,
    scopes: [ORG],
    lockable: false,
  }),
};

export const SIGN_IN_POLICY_KEYS = Object.values(SIGN_IN_POLICY_SETTINGS).map(
  (d) => d.key,
);
