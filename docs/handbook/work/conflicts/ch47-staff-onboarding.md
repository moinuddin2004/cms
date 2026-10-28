# Conflicts and oddities - Chapter 47

- No conflicts with existing docs found. Chapter 37 statements were re-read; the second-location gap (37.3.14) matches the code (create-assignment.dto.ts unused).
- Person record is saved before the login and assignment, outside the final transaction (from ch37, not re-verified in code).

## Security
- Category: authentication hardening. Employee-form logins accept a 6-character password; User Admin requires 8.
