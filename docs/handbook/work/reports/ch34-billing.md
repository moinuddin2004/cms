# Hand-back — Chapter 34 (Billing)

- File: `src/part5-modules/ch34-billing.md`; 34 features: 31 Implemented (several with noted UI gaps), 3 Partial (charges from a treatment plan, unapply, credit packages and patient credits; all backend only), 0 Not implemented.
- Figures: 21 total. 12 placeholders: desk, collect sheet, invoices list, invoice detail, edit sheet, payments, close counter, patient billing tab, settings, expenses, activity, print layouts. 9 diagrams: auto-charges flow, collect sequence, 2 ERDs, and status diagrams for charge, invoice stored, payment, refund and credit. The old billing screenshot is not used.
- Diagrams: all rendered OK; PNGs checked for readability and aspect ratio.
- Not verified: runtime behaviour, because the app was not run.
- Not verified: UI labels. They come from a code research pass and were not seen on screen.
- Not verified: that the "Review" badge maps to `source_removed_at`.
- Not verified in depth: the doctor-revenue and daily-collection SQL (only skimmed).
- Conflicts and one Security item (category level) are in `work/conflicts/ch34-billing.md`.
