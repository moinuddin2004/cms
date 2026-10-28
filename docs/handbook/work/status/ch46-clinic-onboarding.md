| 46 | Self-signup and clinic creation | [Implemented] | POST /auth/register creates user, clinic, MAIN location, trial |
| 46 | Email verification | [Partial] | Informational; nothing gated by email_verified_at |
| 46 | Setup wizard | [Implemented] | Finish does not check earlier steps |
| 46 | Super admin creates organization | [Partial] | Endpoint works; screen form sends values the API rejects; no owner/location created |
| 46 | Create owner login for a super-admin-created clinic | [Partial] | Only through User Admin after selecting the org; sequence deduced, not run |
| 46 | Entitle features | [Implemented] | Several key features are off by default |
| 46 | Owner enables features | [Implemented] | Locked when not entitled |
| 46 | Roles | [Implemented] | Five system roles seeded |
| 46 | Locations | [Implemented] | Edit screen sends fields the API refuses |
| 46 | Theme and navigation | [Implemented] | Nav save bumps access_version; theme save does not |
