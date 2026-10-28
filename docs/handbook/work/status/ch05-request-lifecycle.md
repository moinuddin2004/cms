| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 5 | axios instance with token and tenant headers | [Implemented] | web-app/src/lib/api.ts |
| 5 | Automatic refresh on 401 | [Implemented] | Queues concurrent requests, retries once |
| 5 | Five global guards | [Implemented] | JWT, Tenant, FeatureFlag, Access, Subscription |
| 5 | ValidationPipe whitelist + forbidNonWhitelisted | [Implemented] | Unknown properties give 400 |
| 5 | ResponseWrapper envelope and GlobalExceptionFilter | [Implemented] | Success envelope always says httpStatusCode 200 |
| 5 | ContextMiddleware / TenantContextMiddleware | [Not implemented] | Classes exist, never registered |
| 5 | Patient create transaction with audit | [Implemented] | Phone check and number outside the transaction |
| 5 | Realtime outbox, relay, Redis, Socket.IO | [Implemented] | At-least-once, seq dedupe |
