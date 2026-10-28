# Conflicts: ch61-error-handling

## Oddities
- Two parallel version-conflict codes: VERSION_CONFLICT (queue) and STALE_VERSION (others), plus LAB_BILLING_VERSION_CONFLICT.
## Security
- Error responses: the failure envelope includes a developer message field holding the raw exception text, including for unexpected errors.
