# Tenant Filtering SQL Index

This folder collects copies of SQL migration snippets related to multi-tenant filtering and role-claim handling so they can be reviewed together without altering actual migration order.

Files included (copies for reference):
- 20250914_multi_tenant_phase1.sql (equipment RPCs, app_role usage, optional p_don_vi)
- 20250915_claims_compat.sql (claims fallback app_role/role; equipment functions)
- 20250915_fix_equipment_app_role.sql (forward patch ensuring app_role + p_don_vi)

Note: These are duplicates for observability. The real migrations remain authoritative in the parent folder.
