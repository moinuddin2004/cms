# Conflicts and oddities — Chapter 36

## Doc-vs-code conflicts

| Doc | Claim | Code reality | Evidence |
|---|---|---|---|
| CLAUDE.md | Some dashboard widgets use mock data | Rendered dashboard uses real APIs; mock hooks/widgets are not imported anywhere | features/dashboard imports |
| feature catalog | `reports.exports`: "Export data to CSV / PDF" | Exports are Excel and PDF, no CSV | exporters |

## Oddities

- Dashboard net profit = payments minus refunds minus tax minus expenses only; differs from P&L.
- Dashboard ranges use browser date as UTC; `/financial-summary/daily` defaults to server UTC date.
- Doctor template holds reports.clinical.view=own; sidebar shows Clinic overview but API refuses own scope.
- Doctor revenue/service reports accept doctorId in SQL but have no doctor filter in the spec.
- `useDailySummary` hook unused.

## Security

- Report export is audited; category: data export controls. No further detail.
