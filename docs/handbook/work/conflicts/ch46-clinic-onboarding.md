# Conflicts and oddities - Chapter 46

- OUTLINE says path (b) 'Super admin creates the organization' then continues with entitle and roles. Code: POST /organizations creates no owner and no location; an owner login can be created only through User Admin (type owner) in the active organization context, which for a super admin needs an organization and location to be selected first. Deduced from user.controller/user.service and __root.tsx SUPER_ADMIN_SETUP_PATHS (which does not include /users). Not run.
- Seeding sets is_entitled = is_enabled = enabledByDefault; billing.invoices, billing.commissions, inventory.core, dental.lab_orders, reports.* default to false (feature-catalog.seed.ts).
- Theme service has no access_version bump (grep); nav layouts bump explicitly.

## Security
- Category: onboarding. A super-admin-created owner uses a password set by the administrator; no verification email is sent for admin-created users.
