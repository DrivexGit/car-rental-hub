---
name: Multi-tenancy
description: All tables have tenant_id column with RLS enforcing isolation per tenant
type: feature
---
- `tenants` table holds company/org info
- `staff_profiles.tenant_id` links user to their tenant
- `get_user_tenant_id()` SECURITY DEFINER function used in all RLS policies
- On first login, a new tenant is auto-created and staff profile linked
- All insert operations must include `tenant_id` from AuthContext
- DB docs at `docs/DATABASE.md`
