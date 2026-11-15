# Google Play — Data safety form inputs

> DRAFT inputs for the owner to enter in Play Console (App content → Data safety). Derived from the code and docs as of M4-04 (branch `mobile/develop`). Re-check every row against the final build before submitting. Not legal advice.

## Answers to the top-level questions

| Question | Answer | Why |
| --- | --- | --- |
| Does the app collect or share any of the required user data types? | Yes (collects). | See table below. |
| Is all user data encrypted in transit? | **Yes** | HTTPS only (docs/03). Production API URL must be `https`. |
| Do you provide a way for users to request data deletion? | **Yes** | In-app Account → Delete account (M2-11, patient); web page `/delete-account`; staff via clinic owner or email. |
| Account creation methods | Username/email + password (staff), email one-time code (patient), Google sign-in (both, optional) | M1-17, M2-02, M2-02b |
| Deletion URL | `[WEB_BASE_URL]/delete-account` | Page built in M4-04 |
| Data sold? | No. | |
| Used for advertising or marketing? | No. | No ads SDK. |
| Third-party analytics receiving data? | No. | Own `product_events` only (M2-13). |

"Shared" in Play means transferred to a third party. Processors that act only on our behalf (cloud host, email sender, Expo push relay) are **not** counted as "sharing" under Play's service-provider exemption. Confirm that reading with the lawyer.

## Data types (collected; none sold; none shared except as noted)

| Play category / type | Collected? | Where it comes from | Purpose (Play wording) | Optional? | Processed ephemerally? |
| --- | --- | --- | --- | --- | --- |
| Personal info → **Name** | Yes | Staff account, patient account, profiles | App functionality, Account management | Required | No |
| Personal info → **Email address** | Yes | Staff and patient sign-in | App functionality, Account management | Required | No |
| Personal info → **Phone number** | Yes | Staff account; patient account (optional) | App functionality, Account management | Staff required, patient optional | No |
| Personal info → **User IDs** | Yes | Account ids, Google subject id | App functionality, Account management, Security | Required | No |
| Personal info → **Other info** (date of birth, gender, relationship) | Yes | Patient profiles | App functionality | Required for a profile | No |
| Health and fitness → **Health info** | Yes | Records linked from the clinic: visits, prescriptions, medicine schedules, dose history (patient); patient records the staff user is permitted to see (staff) | App functionality | Optional for the patient (only after linking a clinic) | No |
| Health and fitness → Fitness info | No | | | | |
| Financial info | No | No payments in the app (invoices, if shown, come from the clinic, are not collected from the user). Re-check if billing screens are added. | | | |
| Messages | No | | | | |
| Photos and videos / Audio files | No | | | | |
| Files and docs | No | | | | |
| Calendar / Contacts | No | | | | |
| Location (approximate or precise) | No | The app does not request location permission. | | | |
| App activity → **App interactions** | Yes (if M2-13 ships in the release) | `product_events`: event names and counts, no patient names or health content | Analytics, App functionality | Required | No |
| App activity → Other user-generated content | Yes (staff) | Clinical notes and records entered by staff | App functionality | Required for staff use | No |
| Web browsing | No | | | | |
| App info and performance → **Crash logs / Diagnostics** | **Decision pending (M4-05).** Today `log.error` stays on the device. If a crash reporter is added, declare Crash logs and Diagnostics and update this row. | | | | |
| Device or other IDs → **Device or other IDs** | Yes | Expo push token (staff and patient devices) | App functionality (notifications) | Optional (user may deny notifications) | No |

## Security practices to declare

- Data encrypted in transit: **Yes**.
- Data deletion request: **Yes** (see above).
- Committed to the Play Families Policy: **No** (not a children's app).
- Independent security review: **No** (unless one is done before launch).

## Health apps declaration (Play Console → App content)

Select that the app provides **health information features**, specifically: viewing clinic records (visits, prescriptions), medicine reminders and clinic queue. It is not a medical device, does not diagnose, and does not collect from phone sensors. Add the privacy policy URL `[WEB_BASE_URL]/privacy`.

## Permissions the app asks for (check against the final manifest)

| Permission | Why | Declared as |
| --- | --- | --- |
| Notifications (POST_NOTIFICATIONS) | Queue, appointments, medicine reminders | Device or other IDs (push token) |
| Camera | Staff scanning a QR code; patients may scan a link QR | Not collected, not stored |
| Vibrate / network state | Reminders, connectivity banner | None |

## Sign-off checklist for the owner

- [ ] Privacy policy and terms reviewed by a lawyer, placeholders replaced, hosted at `/privacy` and `/terms`.
- [ ] `/delete-account` shows the real contact email.
- [ ] In-app delete (M2-11) is in the release build.
- [ ] Product events (M2-13) and crash reporting (M4-05) match the rows above.
- [ ] Demo accounts and sign-in instructions entered in Play Console → App access (see `RELEASE.md`).
