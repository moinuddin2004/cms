import { defineSetting, s } from 'src/settings-registry/setting-definition';

/** Platform-only settings for clinic subscriptions (super admin edits them). */
export const SUBSCRIPTION_SETTINGS = {
  /** Shown to clinic owners on Plan & billing: where to send the payment. */
  paymentInstructions: defineSetting<string>(
    'subscription.payment_instructions',
    {
      schema: s.string({ max: 2000 }),
      default:
        'Send the payment by bank transfer or JazzCash, then share the receipt with support. Your plan is extended as soon as the payment is confirmed.',
      scopes: [],
      lockable: false,
    },
  ),
};
