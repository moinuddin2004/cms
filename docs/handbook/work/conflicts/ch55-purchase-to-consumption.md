# Conflicts and oddities - Chapter 55

- Verified in code: stock-movement.entity performedBy is ManyToOne Employee; controllers pass req.user.uuid; purchase_orders.createdBy also FK to employees. Not run.
- OUTLINE expects 'low-stock alert' to end the chain; code only logs.

## Security
- none.
