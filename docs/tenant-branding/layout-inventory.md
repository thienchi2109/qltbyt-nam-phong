# Tenant Branding – Layout & Data Inventory

## Layout surfaces that expose branding
- **`src/app/(app)/layout.tsx`** renders the protected shell with sidebar, header, and footer. The sidebar used the shared `<Logo />` and a hard-coded `NAM PHONG TECHNICAL HI-TECH` label; this is now tenant-aware (see Implementation below). The header previously had no tenant name slot; it now highlights the tenant name with stronger typography.
- The layout gates rendering on `useSession()`. While the session is loading it shows the static logo plus a skeleton, which determines how loading states for tenant branding integrate.
- The layout still fetches repair and transfer requests directly via the global Supabase client. This affects where tenant branding hooks can be mounted without causing extra renders.

## Reusable UI building blocks
- **`src/components/icons.tsx`** exports `<Logo />` (platform logo). Tenant-specific logos use the new `<TenantLogo />` wrapper.
- **`src/components/mobile-footer-nav.tsx`** (imported by the layout) defines the mobile bottom navigation; tenant branding in the header coexists with this footer.
- **`src/components/change-password-dialog.tsx`, `notification-bell-dialog.tsx`, `realtime-status.tsx`** live in the header; branding updates preserve their layout constraints.

## Tenant context & switching utilities
- **`src/components/tenant-switcher.tsx`** (not in layout) still dispatches a `tenant-switched` event. We reuse this event to invalidate tenant-branding caches on unit changes elsewhere.
- **`src/app/api/tenants/memberships/route.ts`** demonstrates server-side consumption of session claims.

## Data access & caching infrastructure
- **`src/providers/query-provider.tsx`** configures React Query with default `staleTime` and `gcTime`. Tenant branding hooks reuse these defaults for low-latency, cached data.
- **`src/app/layout.tsx`** wraps pages with `QueryProvider` and `NextAuthSessionProvider`; tenant branding hook is safe at layout level.

## RPC gateway and Supabase client considerations
- **`src/app/api/rpc/[fn]/route.ts`** whitelists the branding RPC and injects claims (`app_role`, `don_vi`, `user_id`) into a Supabase-signed JWT.
- **`src/lib/rpc-client.ts`** exposes `callRpc` (with AbortSignal support) and is the preferred gateway client. Branding fetchers use it.
- **`src/lib/supabase.ts`** sets up the global Supabase client used by legacy direct table queries. Branding relies on RPCs; awareness is relevant because notifications still use this client.

---

# Implementation (2025-09-18)

## 1) RPC: `don_vi_branding_get`
- Migration: `supabase/migrations/20250918_don_vi_branding_get.sql`
- Signature: `don_vi_branding_get(p_id bigint default null)`
- Returns: `TABLE (id bigint, name text, logo_url text)`
- Behavior:
  - Non-global users: ignores `p_id`, always returns their `don_vi` record.
  - Global users: if `p_id` provided, returns that đơn vị; else falls back to claim `don_vi` (may be null).
  - SECURITY DEFINER; `GRANT EXECUTE TO authenticated`.

## 2) Gateway allow-list
- Added `don_vi_branding_get` to RPC proxy allow-list so authenticated clients can call it with signed tenant claims.

## 3) Hook: `useTenantBranding`
- File: `src/hooks/use-tenant-branding.ts`
- Purpose: Cached fetch of `{ id, name, logo_url }` using TanStack Query.
- Cache key: `['tenant_branding', { tenant: effectiveTenantKey }]` to avoid cross-tenant leakage.
- Invalidation: listens to the `tenant-switched` event and invalidates `tenant_branding` queries.
- Usage:
```tsx
import { useTenantBranding } from "@/hooks/use-tenant-branding"

export function HeaderBranding() {
  const branding = useTenantBranding()
  if (branding.isLoading) return <div className="h-6 w-40 bg-muted animate-pulse" />
  return <span>{branding.data?.name ?? "Nền tảng QLTBYT"}</span>
}
```

## 4) Components
- `src/components/tenant-logo.tsx` – `<TenantLogo src name size rounded />`
  - Renders Next.js `<Image>` with fallback to initials on error/missing source.
- `src/components/tenant-name.tsx` – `<TenantName name fallback />`
  - Strong typography, truncation and ARIA-friendly title.

## 5) Layout updates
- `src/app/(app)/layout.tsx`
  - Sidebar: shows TenantLogo only (no hard-coded text). Skeleton placeholder while loading.
  - Header: shows TenantLogo (small) and TenantName prominently with skeletons while loading.
  - Hooks ordering: `useTenantBranding()` is called once at the top of the component and its data is reused to comply with Rules of Hooks.

## 6) Caching & UX
- React Query options: `staleTime: 5m`, `gcTime: 15m`, `keepPreviousData`.
- AbortSignal passed from queryFn for deduping/canceling in-flight requests during rapid tenant switches.
- Smooth skeleton states used in sidebar and header while data resolves.

## 7) Image hosts (Next.js `remotePatterns`)
Added support for common tenant logo CDNs/hosts:
- Postimage: `i.postimg.cc`, `postimg.cc`
- Imgur: `i.imgur.com`, `imgur.com`
- ImgBB: `i.ibb.co`, `imgbb.com`
- ImageShack: `imagizer.imageshack.com`, `imageshack.com`
- Google Photos (thumbnails): `lh3.googleusercontent.com`, `lh4.googleusercontent.com`, `lh5.googleusercontent.com`, `lh6.googleusercontent.com`

Configuration lives in `next.config.ts` under `images.remotePatterns`.

## 8) Global account behavior
- If the user is global and no `p_id` override is given, we fall back to platform branding.
- For future: a UI affordance could allow selecting a tenant context for global users.

---

## Quick reference
- RPC: `don_vi_branding_get(p_id?) -> { id, name, logo_url }`
- Hook: `useTenantBranding(overrideDonViId?)` returns `{ data, isLoading, isError }`
- UI: `<TenantLogo />`, `<TenantName />`
- Events: listens for `tenant-switched` to invalidate caches
- No cross-tenant leakage due to:
  - JWT claims on gateway
  - RPC logic enforcing tenant scope for non-global users
  - Query keys include effective tenant

## Testing checklist
- Non-global user sees their đơn vị logo in sidebar and name in header.
- Switching tenants (where available) triggers cache invalidation; branding updates smoothly.
- Global user without override sees platform branding; with override (future), sees selected tenant.
- Images load from allowed hosts; broken/missing logos fall back to initials.
- No regressions in NextAuth or other RPC flows.
