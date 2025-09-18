# Tenant Branding – Layout & Data Inventory

## Layout surfaces that expose branding
- **`src/app/(app)/layout.tsx`** renders the protected shell with sidebar, header, and footer. The sidebar uses the shared `<Logo />` component and a hard-coded `NAM PHONG TECHNICAL HI-TECH` label that will need to become tenant-aware. The header currently reserves space for controls (sidebar toggle, realtime status, notifications, user menu) but has no tenant name slot yet. Mobile navigation reuses the same static logo and text inside a `Sheet` component.
- The layout gates rendering on `useSession()`. While the session is loading it shows the static logo plus a skeleton, which determines how loading states for tenant branding must integrate.
- The layout still fetches repair and transfer requests directly via the global Supabase client. This affects where tenant branding hooks can be mounted without causing extra renders.

## Reusable UI building blocks
- **`src/components/icons.tsx`** exports `<Logo />`, which is hard-wired to a single hosted image. Supporting tenant logos will require adding dynamic `src` handling or wrapping this component with a tenant-aware variant.
- **`src/components/mobile-footer-nav.tsx`** (imported by the layout) defines the mobile bottom navigation, so any tenant branding placement on small screens must work alongside this persistent footer.
- **`src/components/change-password-dialog.tsx`, `notification-bell-dialog.tsx`, `realtime-status.tsx`** are embedded in the header region. Branding updates need to coexist with their layout constraints when rearranging header content.

## Tenant context & switching utilities
- **`src/components/tenant-switcher.tsx`** still exists, dispatching a `tenant-switched` event after `/api/tenants/switch` POST requests. Even though the switcher is no longer rendered in the layout, the event can be reused to invalidate tenant branding caches when users change units elsewhere.
- **`src/app/api/tenants/memberships/route.ts`** serves the tenant membership list used by the switcher. It distinguishes between global and non-global roles and demonstrates how session claims are consumed server-side.

## Data access & caching infrastructure
- **`src/providers/query-provider.tsx`** configures React Query with a five-minute `staleTime`, ten-minute `gcTime`, and background refetch interval. Tenant branding hooks should plug into this provider to reuse caching defaults and minimize Supabase calls.
- **`src/app/layout.tsx`** shows that every page is wrapped with `QueryProvider`, `NextAuthSessionProvider`, and realtime/language contexts, so any tenant branding context can be layered alongside these providers.

## RPC gateway and Supabase client considerations
- **`src/app/api/rpc/[fn]/route.ts`** enforces an allow-list of RPC names, injects `app_role`, `don_vi`, and `user_id` claims into Supabase-signed JWTs, and sanitizes `p_don_vi` for non-global users. The upcoming tenant branding RPC must be added here to stay accessible through the gateway.
- **`src/lib/rpc-client.ts`** exposes `callRpc`, the typed fetch wrapper for the gateway. Tenant branding data fetchers should prefer this helper to keep error handling consistent.
- **`src/lib/supabase.ts`** sets up the global Supabase client used by legacy direct table queries. While branding should rely on RPCs, awareness of this client is important because it still drives notification data inside the layout.
