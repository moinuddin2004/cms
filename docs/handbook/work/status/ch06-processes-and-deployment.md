| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 6 | Process roles all/api/worker | [Implemented] | AppModule.forRole |
| 6 | npm start:prod | [Partial] | Points at dist/main; build emits dist/src/main.js |
| 6 | Queue outbox relay and notification relay | [Implemented] | LISTEN/NOTIFY plus polling |
| 6 | 8 scheduled jobs | [Implemented] | Server timezone for triggers |
| 6 | Inventory alerts job | [Partial] | Only logs, no notification |
| 6 | Redis buses (realtime, access, settings) | [Implemented] | Fail-fast connections |
| 6 | Schema sync in dev, schema:sync:prod, startup migrations | [Implemented] | Per docs/database-migrations.md |
| 6 | Environment-specific config | [Partial] | Only NODE_ENV switch |
| 6 | Deployment, CI, containers | [Not implemented] | No files in repo |
| 6 | Login rate limit across instances | [Partial] | In-memory per process |
