# Conflicts and oddities - Chapter 52

- OUTLINE says 'refund to the same account'. Code: the refund form chooses the account under 'Paid out from'; sources are chosen by payment, but the paying-out account is not forced to match (ch34 34.3.22). Chapter states the code behaviour.

## Security
- Category: financial controls. Void and refund are high-risk permissions; unapply has no screen so is reachable only by API clients with billing.invoice.edit.
