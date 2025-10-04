# QLTB Nam Phong - Architecture Quick Reference

## Technology Stack
- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS + Radix UI
- **Backend**: PostgreSQL with Supabase + RPC functions (SECURITY DEFINER)
- **Authentication**: NextAuth v4 with JWT-based multi-tenant claims
- **State Management**: TanStack Query v5 with optimized caching
- **Deployment**: Dual-target (Vercel primary, Cloudflare Workers secondary)

## Project Structure
```
src/
├── app/(app)/[feature]/page.tsx     # Feature pages
├── app/api/[feature]/route.ts        # API routes
├── components/[feature]/             # UI components
├── hooks/use-*.ts                    # Custom hooks
├── lib/rpc-client.ts                 # Supabase RPC client
├── lib/supabase.ts                   # Supabase configuration
├── auth/config.ts                    # NextAuth configuration
├── middleware.ts                     # Route protection
└── types/database.ts                 # TypeScript interfaces

supabase/migrations/                  # Database schema changes
scripts/                             # Build and deployment scripts
```

## Multi-Tenant Security Pattern
```sql
-- Standard tenant validation in all RPC functions
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), '');
  v_claim_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_effective_donvi BIGINT := NULL;
BEGIN
  IF lower(v_role) = 'global' THEN
    v_effective_donvi := p_don_vi; -- Global users see all tenants
  ELSE
    v_effective_donvi := v_claim_donvi; -- Regular users see only their tenant
  END IF;
  
  -- All queries: WHERE (v_effective_donvi IS NULL OR table.don_vi = v_effective_donvi)
END;
```

## Database Access Rules
1. **ALWAYS** use Supabase RPC proxy (`/api/rpc/[fn]`)
2. **NEVER** access Supabase tables directly from client/server
3. **REQUIRE** tenant validation in all RPC functions
4. **SIGN** all RPC requests with SUPABASE_JWT_SECRET
5. **WHITELIST** all functions in `src/app/api/rpc/[fn]/route.ts`

## Import Hierarchy (Strict Order)
1. React/Next.js core imports
2. Third-party libraries
3. Internal components (@/components)
4. Internal utilities (@/lib)
5. Types (@/types)
6. Use @/* alias for all internal imports

## Key Files for Development
- `src/auth/config.ts` - Authentication configuration
- `src/middleware.ts` - Route protection
- `src/app/api/rpc/[fn]/route.ts` - RPC proxy whitelist
- `src/lib/rpc-client.ts` - Database client
- `next.config.ts` - Build configuration
- `supabase/migrations/` - Database changes

## Performance Optimization Patterns
- **TanStack Query**: 5-minute stale time for historical data
- **Progressive Loading**: "Load More" for large datasets
- **Date Windowing**: Limit historical queries to specific ranges
- **Cache Invalidation**: Proper tag-based invalidation
- **Polling Reduction**: 5-minute intervals for real-time updates

## Role-Based Access Control
- **global**: Full cross-tenant visibility
- **admin**: Organization-wide management
- **technician**: Maintenance and repair operations
- **user**: Basic equipment usage and viewing

## Error Handling Pattern
```typescript
// RPC client error handling
try {
  const result = await supabase.rpc('function_name', params);
  if (result.error) throw result.error;
  return result.data;
} catch (error) {
  const details = error.details ? JSON.parse(error.details) : {};
  throw new Error(details.message || error.message);
}
```

## Development Commands
- `npm run dev` - Development server with Turbopack
- `npm run typecheck` - TypeScript validation (REQUIRED before commits)
- `npm run build` - Production build
- `npm run build:cloudflare` - Cloudflare-specific build
- `npm run deploy:dual` - Deploy to both platforms

## Security Checklist for New Features
☐ Add tenant validation in RPC function
☐ Update RPC whitelist if needed
☐ Test with different user roles
☐ Verify cross-tenant data isolation
☐ Add proper error handling
☐ Update TypeScript interfaces

## Cache Invalidation Patterns
```typescript
// Server-side cache invalidation
revalidatePath('/equipment');
revalidateTag('equipment-list');
revalidateTag('dashboard-stats');
```

This reference provides the essential architecture patterns needed for rapid development while maintaining security and performance standards.