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
  relation: {
    self: 'میں خود',
    child: 'میرا بچہ',
    parent: 'میرے والدین',
    spouse: 'میرا جیون ساتھی',
    other: 'دیگر رشتہ دار',
  },
  gender: {
    male: 'مرد',
    female: 'عورت',
    other: 'دیگر',
  },
  family: {
    title: 'خاندان',
    subtitle: 'وہ افراد جن کا ریکارڈ آپ اس ایپ میں سنبھالتے ہیں۔',
    add: 'خاندان کا فرد شامل کریں',
    you: 'آپ',
    noLinks: 'ابھی کسی کلینک سے منسلک نہیں',
    linkedCount: 'منسلک کلینک: {count}',
    addHint:
      'After adding someone, ask the reception at their clinic to show a link code, then choose "My child" or "My parent".', // TODO(ur)
    empty: {
      title: 'ابھی خاندان کا کوئی فرد نہیں',
      body: 'Add a family member, then ask the reception at their clinic for a link code.', // TODO(ur)
    },
    loadFailed: {
      title: "We couldn't load your family", // TODO(ur)
      body: 'اپنا انٹرنیٹ چیک کریں اور دوبارہ کوشش کریں۔',
    },
    sheet: {
      addTitle: 'خاندان کا فرد شامل کریں',
      editTitle: 'پروفائل میں ترمیم',
      name: 'پورا نام',
      namePlaceholder: 'نام جیسا کلینک میں درج ہے',
      relation: 'رشتہ',
      dob: 'تاریخِ پیدائش',
      dobHint: 'Format YYYY-MM-DD (optional)', // TODO(ur)
      gender: 'جنس',
      add: 'شامل کریں',
      save: 'محفوظ کریں',
      close: 'بند کریں',
      discardTitle: 'تبدیلیاں رد کریں؟',
      discardBody: 'Your changes have not been saved.', // TODO(ur)
      discardConfirm: 'رد کریں',
      keepEditing: 'ترمیم جاری رکھیں',
      nameRequired: 'براہِ کرم نام درج کریں',
      nameTooLong: 'نام بہت لمبا ہے',
      relationRequired: 'Choose how this person is related to you', // TODO(ur)
      dobInvalid: 'Enter a real date as YYYY-MM-DD', // TODO(ur)
      dobFuture: 'Date of birth cannot be in the future', // TODO(ur)
      addFailed: "We couldn't add this family member. Please try again.", // TODO(ur)
      saveFailed: "We couldn't save the changes. Please try again.", // TODO(ur)
      tooMany: 'You have reached the limit of family members on one account.', // TODO(ur)
    },
    detail: {
      title: 'پروفائل',
      edit: 'پروفائل میں ترمیم',
      remove: 'Remove family member', // TODO(ur)
      removeTitle: 'Remove {name}?', // TODO(ur)
      removeBody: 'This profile will be removed from your account. Clinic records are not affected.', // TODO(ur)
      removeConfirm: 'ہٹائیں',
      removeBlocked: 'Unlink this family member from their clinics first.', // TODO(ur)
      removeFailed: "We couldn't remove this family member. Please try again.", // TODO(ur)
      removed: 'Family member removed', // TODO(ur)
      notFound: {
        title: 'Profile not found', // TODO(ur)
        body: 'It may have been removed.', // TODO(ur)
      },
      loadFailed: {
        title: "We couldn't load this profile", // TODO(ur)
        body: 'اپنا انٹرنیٹ چیک کریں اور دوبارہ کوشش کریں۔',
      },
      links: 'منسلک کلینک',
      noLinks: 'Not linked to any clinic yet. Ask the clinic reception for a link code.', // TODO(ur)
      linkedSince: 'Linked {date}', // TODO(ur)
      readOnly: 'صرف پڑھنے کے لیے',
      manageClinics: 'Manage linked clinics', // TODO(ur)
      born: 'Born {date}', // TODO(ur)
    },
  },
  clinics: {
    title: 'منسلک کلینک',
    subtitle: 'Clinics that share their records with you.', // TODO(ur)
    linked: 'منسلک',
    history: 'تاریخ',
    forProfile: '{name} کے لیے',
    since: 'Linked {date}', // TODO(ur)
    linkedBy: 'Linked by the reception at {clinic}', // TODO(ur)
    frozen: 'صرف پڑھنے کے لیے',
    suspended: 'Clinic paused', // TODO(ur)
    unlink: 'منسلکی ختم کریں',
    unlinkTitle: 'Unlink {clinic}?', // TODO(ur)
    unlinkBody: "{clinic}'s records will disappear from your app. The clinic keeps its records.", // TODO(ur)
    unlinkConfirm: 'منسلکی ختم کریں',
    unlinkFailed: "We couldn't unlink this clinic. Please try again.", // TODO(ur)
    unlinked: 'Clinic unlinked', // TODO(ur)
    showHistory: 'Link history', // TODO(ur)
    hideHistory: 'Hide history', // TODO(ur)
    historyLoading: 'لوڈ ہو رہا ہے…',
    historyFailed: "We couldn't load the history.", // TODO(ur)
    historyEmpty: 'No history yet.', // TODO(ur)
    event: {
      linked: 'منسلک ہوا',
      unlinked_by_you: 'Unlinked by you', // TODO(ur)
      revoked_by_clinic: 'Removed by the clinic', // TODO(ur)
      revoked_by_system: 'Removed automatically', // TODO(ur)
    },
    revoked: {
      patient: 'Unlinked by you {date}', // TODO(ur)
      clinic: 'Removed by the clinic {date}', // TODO(ur)
      system: 'Removed automatically {date}', // TODO(ur)
      unknown: 'Unlinked {date}', // TODO(ur)
    },
    empty: {
      title: 'No linked clinics', // TODO(ur)
      body: 'Ask the reception at your clinic to show a link code and scan it to link your records.', // TODO(ur)
    },
    loadFailed: {
      title: "We couldn't load your clinics", // TODO(ur)
      body: 'اپنا انٹرنیٹ چیک کریں اور دوبارہ کوشش کریں۔',
    },
  },
  account: {
    delete: {
      title: 'اکاؤنٹ حذف کریں',
      subtitle: 'This cannot be undone.', // TODO(ur)
      willDelete: 'What will be deleted', // TODO(ur)
      item1: 'Your account and sign-in', // TODO(ur)
      item2: 'All profiles, yours and your family', // TODO(ur)
      item3: 'Reminders and dose history', // TODO(ur)
      item4: 'Every link to a clinic', // TODO(ur)
      willKeep:
        'What stays: the records your clinics hold about you. They belong to the clinics and are not deleted.', // TODO(ur)
      typeLabel: 'Type DELETE to confirm', // TODO(ur)
      typePlaceholder: 'DELETE',
      mismatch: 'Type DELETE exactly as shown', // TODO(ur)
      submit: 'میرا اکاؤنٹ حذف کریں',
      submitting: 'حذف ہو رہا ہے…',
      confirmTitle: 'Delete your account for good?', // TODO(ur)
      confirmBody:
        'Your account, profiles, reminders and clinic links will be removed. You cannot undo this.', // TODO(ur)
      confirmAction: 'ہمیشہ کے لیے حذف کریں',
      failed: "We couldn't delete your account. Check your connection and try again.", // TODO(ur)
    },
  },
  contact: {
    open: 'Contact and emergency', // TODO(ur)
    title: 'Contact and emergency', // TODO(ur)
    close: 'Close contact sheet', // TODO(ur)
    clinics: 'Your clinics', // TODO(ur)
    none: 'No contact details yet for your linked clinics.', // TODO(ur)
    loadFailed: "We couldn't load your clinics", // TODO(ur)
    call: 'Call', // TODO(ur)
    whatsapp: 'WhatsApp',
    directions: 'Directions', // TODO(ur)
    callA11y: 'Call {name}', // TODO(ur)
    whatsappA11y: 'WhatsApp {name}', // TODO(ur)
    directionsA11y: 'Directions to {name}', // TODO(ur)
    openFailed: 'Could not open this link', // TODO(ur)
    emergency: {
      title: 'Emergency', // TODO(ur)
      body: 'In an emergency call your local emergency number first, not your clinic.', // TODO(ur)
      default: 'Emergency services', // TODO(ur)
    },
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
      confirm: 'Confirm appointment', // TODO(ur)
      confirming: 'Confirming…', // TODO(ur)
      confirmed: 'You confirmed this appointment', // TODO(ur)
      confirmFailed: 'Could not confirm. Please try again.', // TODO(ur)
      confirmGone: 'This appointment can no longer be confirmed.', // TODO(ur)
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
  // TODO(ur): the `reminders` and `today` blocks below carry the English text until reviewed.
  reminders: {
    notify: {
      titleFor: '{name}: {medicine}',
      bodyFallback: 'Time for your medicine.',
      privateTitle: 'Medicine reminder',
      privateTitleFor: 'Medicine reminder for {name}',
      privateBody: 'Open the app to see the dose.',
    },
    meal: {
      BEFORE_MEAL: 'Before meal',
      AFTER_MEAL: 'After meal',
      WITH_MEAL: 'With meal',
      EMPTY_STOMACH: 'On an empty stomach',
    },
    settings: {
      title: 'Reminders',
      permissionOn: 'Reminders are on',
      permissionOnBody: 'Your phone will remind you at dose times, even without internet.',
      permissionOff: 'Reminders are off',
      permissionOffBody: 'Allow notifications for this app so your phone can remind you.',
      turnOn: 'Turn on reminders',
      openSettings: 'Open phone settings',
      privateTitle: 'Private reminders',
      privateBody: 'Hide the medicine name on the lock screen. Reminders only say "Medicine reminder".',
      batteryTitle: 'Reminders not ringing?',
      batteryBody: 'Some phones stop apps in the background. Fix it in a minute.',
    },
    battery: {
      title: 'Keep reminders ringing',
      intro:
        'To save battery, some phones stop apps from sounding alarms. Do these steps once so your medicine reminders are never missed.',
      stepsTitle: 'On every phone',
      generic1: 'Allow notifications for this app.',
      generic2: 'Set battery use for this app to "Unrestricted" or "No restrictions".',
      generic3: 'Allow "Alarms & reminders" if your phone asks.',
      brandsTitle: 'Your phone brand',
      xiaomi: 'Xiaomi / Redmi / Poco: Settings > Apps > this app > Autostart ON, and Battery saver > No restrictions.',
      huawei: 'Huawei / Honor: Settings > Battery > App launch > this app > Manage manually, allow all three switches.',
      oppo: 'Oppo / Realme / Vivo: Settings > Battery > this app > Allow background activity, and turn Auto launch ON.',
      samsung: 'Samsung: Settings > Battery > Background usage limits > remove this app from "Sleeping apps".',
      oneplus: "OnePlus: Settings > Battery > Battery optimisation > this app > Don't optimise.",
      other: 'Other phones: look for "Battery optimisation" or "Background activity" in the app settings.',
      openSettings: 'Open app settings',
    },
  },
  today: {
    title: 'Today',
    remindersAction: 'Reminder settings',
    groups: {
      morning: 'Morning',
      afternoon: 'Afternoon',
      evening: 'Evening',
      night: 'Night',
    },
    taken: 'Taken',
    skipped: 'Skipped',
    skipDose: 'Skip this dose',
    more: 'More actions for {medicine}',
    markTaken: 'Mark {medicine} as taken',
    waitingToSync: 'Will sync when you are back online',
    statusFailed: "Couldn't load dose status — tap to retry", // TODO(ur)
    courseEnds: 'Course ends in {days} days',
    courseEndsToday: 'Last day of this course',
    courseEndsTomorrow: 'Course ends tomorrow',
    appointmentsToday: 'Appointments today',
    comingUp: 'Coming up',
    nothingDue: 'Nothing due today.',
    nothingDueBody: 'New doses show up here when your doctor prescribes medicine.',
    firstTitle: 'Link your first clinic',
    firstBody: 'Ask the reception for the app QR code. Your medicines and visits will show up here.',
    error: "We couldn't load today",
    errorBody: 'Check your connection and try again.',
    turnOnTitle: 'Turn on reminders?',
    turnOnBody: 'Your phone can remind you at each dose time, even without internet.',
    deniedTitle: 'Reminders are blocked',
    deniedBody: 'Notifications are off for this app, so no dose reminders will ring.',
    unsentOne: '1 change waiting to sync',
    unsentMany: '{count} changes waiting to sync',
    familyMember: 'Family member',
  },
  offline: {
    title: 'آپ آف لائن ہیں',
    body: "We couldn't reach the server. Your session is safe — check your connection and try again.", // TODO(ur)
  },
};
