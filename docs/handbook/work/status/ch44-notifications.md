| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 44 | See notifications in the header bell | [Implemented] | 30 s polled badge, 20 newest items, own inbox only |
| 44 | Mark notifications as read | [Implemented] | one or all; no mark-unread or delete |
| 44 | Raise a notification event | [Implemented] | enqueue in caller transaction; 6-step decision order |
| 44 | Deliver messages in the background | [Implemented] | LISTEN + 2 s poll, skip-locked claim, 5 attempts; in-app only |
| 44 | Choose who is notified (switches and rules) | [Implemented] | audited; mandatory rules locked |
| 44 | Set quiet hours | [Partial] | saved but never holds in-app messages |
| 44 | Edit message wording in several languages | [Implemented] | en / ur / roman_ur; placeholder validation |
| 44 | Review the message log | [Implemented] | filters by status, channel, text |
| 44 | Patient messaging opt-outs and language | [Partial] | backend works; UI card commented out |
| 44 | Notify through a workflow transition | [Partial] | notify effect exists; no shipped transition found using it |
| 44 | Send to patients by WhatsApp, SMS or email | [Not implemented] | no patient channel; dev-log stand-in only |
| 44 | Appointment reminders | [Not implemented] | no event, no job |
