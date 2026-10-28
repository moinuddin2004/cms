# Conflicts: ch63-realtime-and-jobs

## Oddities
- `common/utils/socket-gateway.ts` defines a second gateway registered in CommonModule that writes handshake data to the console; no emitter found, unclear if used.
- Appendix E and ch05 agree with this chapter.
## Security
- Socket handshake token verified once; connections outlive token expiry.
- Logging: a legacy gateway writes token-related data to the console.
