# Conflicts: ch62-time-money-numbering

## Oddities
- Two prescription numbering schemes: patient page `RX-00001` (count) and prescriptions module `RX-YYYY-00001` (last+1, unique across all organizations).
- purchase_orders.po_number unique index is global, not per organization.
- Patient number counts soft-deleted rows, but patients are hard deleted.
- Lab catalog `catalogToday` hard-codes Asia/Karachi.
## Security
- None.
