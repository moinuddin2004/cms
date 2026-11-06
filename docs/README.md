<div align="center">

<img src="images/logo.svg" alt="" width="64" />

<h1>Project documentation</h1>

<p><b>Guides, architecture references, test plans and the system owner's handbook.</b></p>

<p>
<img src="https://img.shields.io/badge/Guides-161b22?style=for-the-badge&logo=readthedocs&logoColor=white" alt="Guides" />
<img src="https://img.shields.io/badge/Architecture-161b22?style=for-the-badge&logo=diagramsdotnet&logoColor=F08705" alt="Architecture" />
<img src="https://img.shields.io/badge/Handbook-161b22?style=for-the-badge&logo=bookstack&logoColor=white" alt="Handbook" />
</p>

<p>
<a href="#start-here"><b>Start here</b></a> &nbsp;·&nbsp;
<a href="#feature-guides"><b>Feature guides</b></a> &nbsp;·&nbsp;
<a href="#architecture-and-data"><b>Architecture &amp; data</b></a> &nbsp;·&nbsp;
<a href="#handbook"><b>Handbook</b></a> &nbsp;·&nbsp;
<a href="#archive"><b>Archive</b></a>
</p>

<sub><a href="../README.md">← Back to the main README</a></sub>

</div>

<br />

## Start here

| If you need to… | Read |
| --- | --- |
| Find a topic or decide which document is current | [`handbook/INVENTORY.md`](handbook/INVENTORY.md) |
| Understand project structure and coding conventions | [`../CLAUDE.md`](../CLAUDE.md) |
| Create a database or apply a schema change | [`../backend/database/README.md`](../backend/database/README.md) |
| Find the main application setup instructions | [`../README.md`](../README.md) |

<br />

## Feature guides

| Guide | Covers |
| --- | --- |
| [`access-control/README.md`](access-control/README.md) | Permissions, roles, feature access, navigation, theme and go-live checklist |
| [`appointments-and-queue.md`](appointments-and-queue.md) | Booking, queue states, operating rules and realtime updates |
| [`commissions.md`](commissions.md) | Doctor compensation and the commission ledger |
| [`notifications-email-plan.md`](notifications-email-plan.md) | Notification and email design, phases and current status |
| [`billing-feature-context.md`](billing-feature-context.md) | Billing background and pre-v2 context; review its status notes before using |
| [`billing-v2-test-cases.md`](billing-v2-test-cases.md) | Billing v2 test plan |
| [`database-migrations.md`](database-migrations.md) | Historical migration notes; use the database guide above for the current process |

<br />

## Architecture and data

| Reference | Covers |
| --- | --- |
| [`auth-access-erd.md`](auth-access-erd.md) | Users, sessions, roles and access tables |
| [`finance-billing-erd.md`](finance-billing-erd.md) | Billing and finance data model |
| [`lab-module-erd.md`](lab-module-erd.md) | Lab module data model |
| [`handbook/src/part5-modules/`](handbook/src/part5-modules/) | Handbook chapters covering implemented modules |

The canonical database definition is the hand-maintained SQL under [`../backend/database/`](../backend/database/), not these diagrams.

<br />

## Testing

| Document | What it is |
| --- | --- |
| [`access-control/test-cases.md`](access-control/test-cases.md) | Access-control acceptance scenarios |
| [`access-control/test-results.md`](access-control/test-results.md) | Recorded results for those scenarios |

<br />

## Handbook

[`handbook/`](handbook/) contains the System Owner's Handbook: editable source chapters are in [`handbook/src/`](handbook/src/) and finished PDFs are in [`handbook/pdf/`](handbook/pdf/). Start with [`00-Complete-Handbook.pdf`](handbook/pdf/00-Complete-Handbook.pdf). The supporting diagrams and work files are kept alongside the handbook.

[`handbook/INVENTORY.md`](handbook/INVENTORY.md) tracks the documents in the repository and their currency.

<br />

## Images

[`images/`](images/) contains the screenshots and logo used by the repository README and app-level READMEs.

<br />

## Archive

Archived material is retained for history. Older plans, audits and snapshots may describe behavior that has since changed.

| File | Context |
| --- | --- |
| [`archive/PLAN-2026-06.md`](archive/PLAN-2026-06.md) | Initial feature roadmap; checklist is stale |
| [`archive/PROJECT_OVERVIEW-2026-10.md`](archive/PROJECT_OVERVIEW-2026-10.md) | October 2026 snapshot; predates major modules |
| [`archive/AUDIT-2026-06.md`](archive/AUDIT-2026-06.md) | June 2026 code audit |
| [`archive/HANDOFF-2026-12.md`](archive/HANDOFF-2026-12.md) | Session hand-off notes |
| [`archive/design/MedTrackr-mockup.dc.html`](archive/design/MedTrackr-mockup.dc.html) | Early, obsolete product mock-up |
