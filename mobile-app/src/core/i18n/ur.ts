import type { Messages } from './en';

/**
 * Urdu catalog — same keys as `en` (the compiler enforces it). Strings without a
 * reviewed translation copy the English text and carry `// TODO(ur)`.
 */
export const ur: Messages = {
  common: {
    back: 'واپس',
    continue: 'جاری رکھیں',
    cancel: 'منسوخ کریں',
    signOut: 'سائن آؤٹ',
    retry: 'دوبارہ کوشش کریں',
    loading: 'لوڈ ہو رہا ہے…',
  },
  auth: {
    signIn: {
      title: 'سائن اِن',
      subtitle: 'اپنے خاندان کے ریکارڈ اور دوائیں ایک جگہ رکھیں۔',
      or: 'یا',
      emailLabel: 'ای میل',
      emailPlaceholder: 'you@example.com',
      sendCode: 'مجھے کوڈ بھیجیں',
      sending: 'بھیجا جا رہا ہے…',
      googleSoon: 'Continue with Google', // TODO(ur)
      legal: 'جاری رکھ کر آپ شرائط اور رازداری کی پالیسی سے اتفاق کرتے ہیں۔',
      invalidEmail: 'براہِ کرم درست ای میل درج کریں',
      failed: "We couldn't send the code. Please try again.", // TODO(ur)
      rateLimited: 'Too many tries. Please wait a few minutes and try again.', // TODO(ur)
    },
    verify: {
      title: 'اپنا کوڈ درج کریں',
      subtitle: 'If {email} can receive a code, we sent one. It is valid for 10 minutes.', // TODO(ur)
      codeLabel: '6 ہندسوں کا کوڈ',
      codePlaceholder: '123456',
      codeInvalid: 'ای میل میں موجود 6 ہندسے درج کریں',
      submit: 'تصدیق کریں',
      submitting: 'تصدیق ہو رہی ہے…',
      resend: 'نیا کوڈ بھیجیں',
      resendIn: 'Send a new code in {seconds}s', // TODO(ur)
      resent: 'If that email can receive a code, a new one is on its way.', // TODO(ur)
      wrongCode: 'That code is not right or has expired. Check it or ask for a new one.', // TODO(ur)
      changeEmail: 'دوسری ای میل استعمال کریں',
      accountDisabled: 'This account is not available. Please contact support.', // TODO(ur)
      failed: "We couldn't verify the code. Please try again.", // TODO(ur)
    },
    name: {
      title: 'ہم آپ کو کس نام سے پکاریں؟',
      subtitle: 'Your name helps your clinic and family recognise you.', // TODO(ur)
      label: 'آپ کا نام',
      placeholder: 'پورا نام',
      required: 'براہِ کرم اپنا نام درج کریں',
      tooLong: 'Name is too long', // TODO(ur)
      submit: 'محفوظ کریں اور جاری رکھیں',
      saving: 'محفوظ ہو رہا ہے…',
      failed: "We couldn't save your name. Please try again.", // TODO(ur)
    },
  },
  home: {
    title: 'خوش آمدید',
    signedInAs: 'Signed in as {email}', // TODO(ur)
    placeholder: 'Your records, medicines and clinic visits will live here.', // TODO(ur)
    switchToStaff: 'Switch to clinic staff', // TODO(ur)
    signOutTitle: 'سائن آؤٹ کریں؟',
    signOutBody: 'You will need a new code to sign in again on this phone.', // TODO(ur)
  },
  offline: {
    title: 'آپ آف لائن ہیں',
    body: "We couldn't reach the server. Your session is safe — check your connection and try again.", // TODO(ur)
  },
};
