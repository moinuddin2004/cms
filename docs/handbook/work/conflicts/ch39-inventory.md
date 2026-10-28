# Conflicts and oddities — Chapter 39

## Doc-vs-code conflicts

| Doc | Claim | Code reality | Evidence |
|---|---|---|---|
| CLAUDE.md | inventory is an entity-only stub | Full module, 5 controllers | backend/src/inventory |
| ENTITY_CATALOG | Notes column shifted for inventory entities | Known defect, notes not used here | guide section 6 |

## Oddities

- Controllers pass req.user.uuid (user id) as performedBy/createdBy; columns are FK to employees. Not run.
- poNumber unique globally, sequence per organization; no year reset.
- Categories: no create UI, seedDefaults never called.
- expiryAlertDays stored but unused; alerts use server time.
- No row lock in applyMovement; item create + initial stock not one transaction.
- Legacy `inventory` entity unregistered (picked up by CLI data-source glob).
- /inventory has no nav entry; ConsumptionRecorder unused.

## Security

- Data-integrity and concurrency category only: stock adjustment lacks locking.
