# Chapter 67 — Open Questions

This chapter lists the decisions and facts that only the product owner can supply. They come from the notes of every handbook chapter, from the questions in the generated organizations and locations chapter, from the ambiguities in the generated entity catalog and from items the code could not settle. Each question has the context and the reason the answer matters, so the answers can steer what is built, fixed or removed next.

## 67.1 Product direction

1. **Which patient channels will the Platform use, and who pays for them?** Context: the message pipeline is built, but only the in-app channel for staff and lab members is active. WhatsApp, SMS and email to patients are commented out, and a log stand-in takes their place. Why it matters: reminders, receipts and lab-delay messages all wait on this choice, and it also decides the privacy and logging work needed (Chapter 66).
2. **Should owners get trial-ending and expiry messages, and how many days ahead?** Context: only an in-app banner warns today; no renewal email is sent. Why it matters: expiry puts a clinic in read-only mode, so a missed warning is a lost day of work and a support call.
3. **Should the Platform have a patient portal, online booking and recurring appointments?** Context: all three were planned and their feature keys were retired. Why it matters: it decides whether the retired keys are deleted or the work is scheduled.
4. **Are insurance claims and an online payment gateway required for target clinics?** Context: insurance details can be stored (backend only) and no claim or gateway exists. Why it matters: these are large features, and the answer avoids building them early or promising them.
5. **Is attendance wanted, and should payroll have deductions, tax and bank files?** Context: payroll is salary plus commission; deductions are always zero; leave is recorded but not read. Why it matters: payroll is the most legally sensitive money flow, and clinics will ask.
6. **What should a blacklisted or inactive patient be prevented from doing?** Context: both flags are informational and block nothing. Why it matters: staff may rely on them, and the answer defines the rule to enforce at booking, check-in and billing.
7. **Should the product name be fixed?** Context: the handbook calls it "the Platform" and each clinic sets its display name; the default is "Clinic Portal". Older documents and some stored keys carry a former working name. Why it matters: it decides what is cleaned out of the code and which documents can be reused.

## 67.2 Clinics, locations and subscriptions

These come from the generated organizations and locations chapter.

8. **Should a clinic created by a super admin start on a trial, or stay unmanaged?** Context: unmanaged clinics have no expiry and no plan limits. Why it matters: it decides whether all clinics are subject to billing.
9. **When a clinic pays for a lower plan during a higher-plan trial, should the payment downgrade it at once?** Context: recording a payment overwrites the plan with the paid plan. Why it matters: it can silently remove features during a trial.
10. **Should deactivating a clinic also make it read-only and end sessions?** Context: today deactivation only hides the clinic at login. Why it matters: owners may still hold working sessions, and the subscription guard is not involved.
11. **Can a clinic have more than one main branch, and which becomes main when one is deactivated?** Context: the main-branch flag is not exclusive. Why it matters: reports and defaults may pick the wrong branch.
12. **Should new branches inherit the clinic's time zone and currency, and should changing the clinic's time zone update existing branches?** Context: locations default to UTC and USD while organizations default to Asia/Karachi and PKR; the setup wizard updates branches but later changes do not. Why it matters: it controls every date and amount a branch shows.
13. **Should the legacy organization settings be removed or wired?** Context: booking defaults, advance booking days, cancellation notice, late fee percentage and old feature switches are saved but read by no backend rule. Why it matters: owners may think these rules are in force.
14. **Who is the location manager meant to be, an employee or a login, and what powers should a manager have?** Context: the column's target is not stated anywhere. Why it matters: a branch-manager role needs a definite owner.
15. **Should staff without the locations permission read booking-related location settings?** Context: slot length and daily cap sit on a screen that needs the manage permission. Why it matters: receptionists may need to see the limits.
16. **Which account type should be created for a person who works only for a lab, and what is the exact sequence to create an owner login for a clinic made by a super admin?** Context: both were deduced, not run. Why it matters: onboarding instructions must be correct.

## 67.3 Data model and numbering

17. **Which id should the `dentist_id` columns hold (employee or login)?** Context: the teeth chart, plans, recalls and feedback store a value with no foreign key and no stated target. Why it matters: reports that join to the person need a defined meaning.
18. **Which id should doctor signatures, inventory movements and purchase orders store?** Context: code passes a login id into columns that are, or look like, employee links. Why it matters: the inventory writes may fail, and signatures are keyed per login across clinics.
19. **Should prescriptions and purchase orders be numbered per organization or across the Platform?** Context: the numbers restart per organization but are unique everywhere. Why it matters: it decides which side of the conflict to change.
20. **Should patients ever be permanently deleted?** Context: deletion breaks numbering and fails when billing exists. Why it matters: it decides between soft delete and a clear refusal.
21. **Is the missing foreign key on tenant columns deliberate?** Context: most billing, queue and lab tables omit it without comment. Why it matters: it decides whether to add keys or document the choice.
22. **Which duplicate concepts should be merged?** Context: legacy and new prescriptions, two audit mechanisms, two sequence mechanisms, per-visit tables with unclear roles. Why it matters: each duplicate doubles the work for every change.
23. **Should the append-only money tables get triggers like the commission ledger?** Context: three tables are protected; others are promised by comments. Why it matters: it is the cheapest strong guard for financial records.
24. **Should the unused tables and columns be dropped (linked sign-ins, per-visit summary, deprecated refresh token, chairs, legacy inventory table)?** Why it matters: they mislead readers and the generated catalog.

## 67.4 Operations and security

25. **Where and how is the Platform deployed, and who supervises the single worker?** Context: no deploy configuration exists. Why it matters: exactly one worker must run, and nothing here shows how that is ensured.
26. **Should the scheduled jobs use each location's time zone?** Context: jobs follow the server clock. Why it matters: payroll month, credit expiry and day-end alerts depend on it.
27. **What is the data retention policy for sessions, security logs, audit rows, messages and consent signatures?** Why it matters: it is the first question a regulator or clinic will ask.
28. **Is the calendar library licence suitable for a commercial product?** Why it matters: it is a legal exposure that can be solved by buying the licence or changing the component.
29. **Should audit extend to appointments, employees, payroll, organizations and locations, with one viewer?** Why it matters: owners cannot otherwise answer who changed a record.
30. **What should be done about the committed test credentials?** Why it matters: rotating them and cleaning history should be scheduled, not assumed.
31. **Should public lab links and the TV display remain unauthenticated by design?** Why it matters: it defines the acceptable exposure and the expiry rules.

## 67.5 Behaviour to confirm by running

32. **Do inventory writes fail because of the id mismatch?** Why it matters: it decides whether inventory can be opened to clinics at all.
33. **Do the prescription change history and duplicate actions fail?** Why it matters: they are small fixes if confirmed.
34. **Do background jobs continue while a clinic is read-only?** Why it matters: payroll and invariants could be skipped or not.
35. **Are uploaded patient documents and PDFs publicly readable by address?** Why it matters: it depends on the storage settings, not on the code.
36. **Which currency column do billing screens read, the location's or the organization's?** Why it matters: a mismatch shows the wrong currency label.
37. **Does the lab ever receive a magic-link message in practice?** Why it matters: today the contact channel is a stand-in, so links must be copied by hand.
38. **Should lab orders link to the appointment and treatment?** Context: the API accepts both, the web app never sends them. Why it matters: try-in scheduling and case reporting depend on it.
39. **Is a printable lab invoice or receipt needed?** Context: none was found. Why it matters: lab patient invoices cannot be handed to patients otherwise.

## 67.6 How the answers are used

The product questions (Section 67.1) set the roadmap. The clinic and numbering questions (Sections 67.2 and 67.3) decide small fixes that remove the High and Medium gaps in Chapter 65. The operations and security questions (Section 67.4) decide the order in Chapter 66. The questions in Section 67.5 need someone to run the application and watch, and they should be answered before the related work is planned.
