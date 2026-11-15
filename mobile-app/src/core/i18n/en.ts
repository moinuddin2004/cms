/**
 * English catalog — the source of truth for message keys (docs/DECISIONS A-12, A-21).
 * Keys are dotted paths; `{name}` marks an interpolation. Patient-space strings
 * only: staff strings stay inline English.
 */
export const en = {
  common: {
    back: 'Back',
    continue: 'Continue',
    cancel: 'Cancel',
    signOut: 'Sign out',
    retry: 'Try again',
    loading: 'Loading…',
  },
  auth: {
    signIn: {
      title: 'Sign in',
      subtitle: "Keep your family's records and medicines in one place.",
      or: 'or',
      emailLabel: 'Email',
      emailPlaceholder: 'you@example.com',
      sendCode: 'Send me a code',
      sending: 'Sending…',
      googleSoon: 'Continue with Google',
      legal: 'By continuing you agree to the Terms and Privacy Policy.',
      invalidEmail: 'Please enter a valid email',
      failed: "We couldn't send the code. Please try again.",
      rateLimited: 'Too many tries. Please wait a few minutes and try again.',
    },
    verify: {
      title: 'Enter your code',
      subtitle: 'If {email} can receive a code, we sent one. It is valid for 10 minutes.',
      codeLabel: '6-digit code',
      codePlaceholder: '123456',
      codeInvalid: 'Enter the 6 digits from the email',
      submit: 'Verify',
      submitting: 'Verifying…',
      resend: 'Send a new code',
      resendIn: 'Send a new code in {seconds}s',
      resent: 'If that email can receive a code, a new one is on its way.',
      wrongCode: 'That code is not right or has expired. Check it or ask for a new one.',
      changeEmail: 'Use a different email',
      accountDisabled: 'This account is not available. Please contact support.',
      failed: "We couldn't verify the code. Please try again.",
    },
    name: {
      title: 'What should we call you?',
      subtitle: 'Your name helps your clinic and family recognise you.',
      label: 'Your name',
      placeholder: 'Full name',
      required: 'Please enter your name',
      tooLong: 'Name is too long',
      submit: 'Save and continue',
      saving: 'Saving…',
      failed: "We couldn't save your name. Please try again.",
    },
  },
  home: {
    title: 'Welcome',
    greeting: 'Welcome, {name}',
    signedInAs: 'Signed in as {email}',
    placeholder: 'Your records, medicines and clinic visits will live here.',
    switchToStaff: 'Switch to clinic staff',
    signOutTitle: 'Sign out?',
    signOutBody: 'You will need a new code to sign in again on this phone.',
  },
  claim: {
    signInHint: 'Sign in to link your record.',
    invalid: {
      title: "This link doesn't work",
      body: 'The code is not valid. Ask the reception for a new one.',
      action: 'Close',
    },
    confirm: {
      title: 'Link your record',
      loading: 'Checking your code…',
      record: 'Record: {name}',
      recordAge: 'Record: {name}, {age}',
      whose: 'Whose record is this?',
      relSelf: 'Me',
      relChild: 'My child',
      relParent: 'My parent',
      relOther: 'Someone else I care for',
      nameLabel: 'Name of this person',
      namePlaceholder: 'Full name',
      nameRequired: "Please enter this person's name",
      consent: "I confirm I may view this person's records",
      consentRequired: 'Please confirm to continue',
      submit: 'Link record',
      submitting: 'Linking…',
      cancel: 'Not now',
      alreadyYours: 'This record is already linked to your account.',
    },
    success: {
      title: 'All set',
      body: "Linked. You'll now see visits and medicines from {clinic}.",
      done: 'Continue',
    },
    errors: {
      invalid: 'This code has expired or was already used. Ask the reception for a new one.',
      suspended: "This clinic can't link records right now. Please ask the clinic to help.",
      appDisabled: "This clinic hasn't turned on the patient app yet. Please ask the reception.",
      alreadyLinked:
        'This record is already linked to another account. Ask the reception if you think this is a mistake.',
      nameRequired: "Please enter this person's name.",
      relationMismatch: 'That choice does not match your saved family members. Please pick again.',
      rateLimited: 'Too many tries. Please wait a few minutes and try again.',
      network: 'No connection. Check your internet and try again.',
      generic: "We couldn't link the record. Please try again.",
    },
  },
  offline: {
    title: 'You are offline',
    body: "We couldn't reach the server. Your session is safe — check your connection and try again.",
  },
} as const;

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };

/** The catalog shape every locale must follow. */
export type Messages = Widen<typeof en>;

type Paths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${Paths<T[K]>}`;
}[keyof T & string];

/** Every valid message key, e.g. `'auth.signIn.title'`. */
export type MessageKey = Paths<Messages>;
