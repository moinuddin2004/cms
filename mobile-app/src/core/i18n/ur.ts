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
    greeting: 'خوش آمدید، {name}',
    signedInAs: 'Signed in as {email}', // TODO(ur)
    placeholder: 'Your records, medicines and clinic visits will live here.', // TODO(ur)
    switchToStaff: 'Switch to clinic staff', // TODO(ur)
    signOutTitle: 'سائن آؤٹ کریں؟',
    signOutBody: 'You will need a new code to sign in again on this phone.', // TODO(ur)
  },
  records: {
    title: 'ریکارڈ',
    tab: 'ریکارڈ',
    homeTab: 'ہوم',
    search: 'Search clinic or doctor', // TODO(ur)
    clearSearch: 'Clear search', // TODO(ur)
    segments: {
      appointments: 'اپائنٹمنٹس',
      visits: 'وزٹس',
      prescriptions: 'نسخے',
      bills: 'بل',
    },
    empty: {
      appointments: 'No appointments yet', // TODO(ur)
      appointmentsBody: 'Appointments from your linked clinics will show up here.', // TODO(ur)
      visits: 'No visits yet', // TODO(ur)
      visitsBody: 'Completed visits from your linked clinics will show up here.', // TODO(ur)
      prescriptions: 'No prescriptions yet', // TODO(ur)
      prescriptionsBody: 'Prescriptions from your doctors will show up here.', // TODO(ur)
      bills: 'No bills yet', // TODO(ur)
      billsBody: 'Bills from your linked clinics will show up here.', // TODO(ur)
    },
    noResults: 'Nothing matches your search', // TODO(ur)
    noResultsBody: 'Try a different word or clear the search.', // TODO(ur)
    clearAll: 'Clear search', // TODO(ur)
    error: "We couldn't load your records", // TODO(ur)
    errorBody: 'Check your connection and try again.', // TODO(ur)
    openFailed: 'Could not open this link', // TODO(ur)
    moreFailed: "We couldn't load more", // TODO(ur)
    clinicPaused: 'This clinic is paused', // TODO(ur)
    clinicPausedBody: 'You can still read your records. New bookings are not available.', // TODO(ur)
    with: '{name} کے ساتھ',
    status: {
      scheduled: 'طے شدہ',
      confirmed: 'تصدیق شدہ',
      checked_in: 'پہنچ گئے',
      completed: 'مکمل',
      cancelled: 'منسوخ',
      no_show: 'Missed', // TODO(ur)
    },
    invoice: {
      paid: 'ادا شدہ',
      partial: 'Part paid', // TODO(ur)
      unpaid: 'Unpaid', // TODO(ur)
      overdue: 'Overdue', // TODO(ur)
    },
    appointment: {
      types: {
        consultation: 'Consultation', // TODO(ur)
        follow_up: 'Follow-up', // TODO(ur)
        treatment: 'Treatment', // TODO(ur)
        checkup: 'Check-up', // TODO(ur)
        emergency: 'Emergency', // TODO(ur)
        cleaning: 'Cleaning', // TODO(ur)
      },
      title: 'اپائنٹمنٹ',
      notFound: 'We could not find this appointment', // TODO(ur)
      when: 'When', // TODO(ur)
      clinic: 'کلینک',
      doctor: 'ڈاکٹر',
      status: 'Status', // TODO(ur)
      type: 'Type', // TODO(ur)
      callClinic: 'Call clinic', // TODO(ur)
      directions: 'Directions', // TODO(ur)
    },
    visit: {
      followUp: 'Follow-up on {date}', // TODO(ur)
      diagnosis: 'Diagnosis', // TODO(ur)
      treatments: 'Treatments', // TODO(ur)
    },
    prescription: {
      timing: {
        morning: 'Morning', // TODO(ur)
        afternoon: 'Afternoon', // TODO(ur)
        evening: 'Evening', // TODO(ur)
        night: 'Night', // TODO(ur)
        sos: 'Only if needed', // TODO(ur)
      },
      title: 'نسخہ',
      notFound: 'We could not find this prescription', // TODO(ur)
      medicines: '{count} medicines', // TODO(ur)
      medicine: '1 medicine', // TODO(ur)
      doctor: 'ڈاکٹر',
      date: 'Date', // TODO(ur)
      dose: 'Dose', // TODO(ur)
      howOften: 'How often', // TODO(ur)
      when: 'When', // TODO(ur)
      howLong: 'For how long', // TODO(ur)
      instructions: 'Instructions', // TODO(ur)
      meal: {
        BEFORE_MEAL: 'Before food', // TODO(ur)
        AFTER_MEAL: 'After food', // TODO(ur)
        WITH_MEAL: 'With food', // TODO(ur)
        EMPTY_STOMACH: 'On an empty stomach', // TODO(ur)
        NONE: 'Any time', // TODO(ur)
      },
    },
    bill: {
      total: 'Total', // TODO(ur)
      paid: 'ادا شدہ',
      balance: 'Balance', // TODO(ur)
      number: 'Bill {number}', // TODO(ur)
    },
  },
  // TODO(ur): translate the claim strings
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
    title: 'آپ آف لائن ہیں',
    body: "We couldn't reach the server. Your session is safe — check your connection and try again.", // TODO(ur)
  },
};
