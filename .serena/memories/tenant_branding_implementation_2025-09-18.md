# Tenant Branding Implementation (Completed) – 2025-09-18

## What was added
- RPC: `don_vi_branding_get(p_id bigint default null)` with tenant-safe behavior (SECURITY DEFINER; EXECUTE to authenticated).
- Gateway: whitelisted `don_vi_branding_get` and kept claim injection via JWT.
- Hook: `useTenantBranding(overrideDonViId?)` (TanStack Query; tenant-scoped key; listens to `tenant-switched`).
- UI: `TenantLogo` (Next/Image + initials fallback), `TenantName` (typography, truncation, ARIA).
- Layout updates: Sidebar shows tenant logo only; header highlights tenant name; skeletons during loading; single top-level branding hook to satisfy Rules of Hooks.
- Next.js images: added remotePatterns for Postimage, Imgur, ImgBB, ImageShack, and Google Photos hosts.

## Caching & UX
- `staleTime=5m`, `gcTime=15m`, `keepPreviousData`; AbortSignal used for request dedup/cancel.
- Invalidation on `tenant-switched` event; no cross-tenant leakage (tenant-scoped query keys + RPC constraints).

## Validation
- Manual tests passed across tenants and global; no regressions in NextAuth/RPC; typecheck clean.

## Follow-ups (optional)
- Context provider (if needed); examples for future forms using `<TenantLogo/>` + `<TenantName/>`.
