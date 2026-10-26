# Glossary — ch20-billing-core

- **Service catalog** — the organization's list of billable services: consultation, procedures, other (`services`, class `CatalogService`).
- **Service price** — a location-wide or doctor-specific override of a service's default price (`service_prices`).
- **Charge** — one billable line for a patient; the atomic unit of billing (`charges`).
- **Invoice** — an issued document grouping a patient's charges; no drafts (`invoices`).
- **Payment** — money received from a patient; belongs to the patient, not an invoice (`payments`).
- **Allocation** — signed record of how much of a payment was applied to a charge or released back (`payment_allocations`).
- **Advance** — money received and not allocated or refunded (derived; no table).
- **Refund** — money returned to a patient, always from advance (`refunds`).
- **Refund source** — which payment's advance funded a refund (`refund_sources`).
- **Discount type** — an owner-defined discount preset (`discount_types`).
- **Payment account** — one way a location receives money: cash, bank, wallet (`payment_accounts`).
- **Location billing settings** — one row of billing settings per location, including the document code (`location_billing_settings`).
- **Document code** — the 2–6 character location code printed in invoice, receipt and refund numbers (`location_billing_settings.document_code`).
- **Client request id** — a per-action id sent by the web app so a retried payment or refund is not recorded twice (`client_request_id`).
- **Billing v2** — the code's name for the current charge-based billing design.
