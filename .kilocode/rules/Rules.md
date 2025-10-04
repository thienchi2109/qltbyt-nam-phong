
## Core Principles

1. **Token Efficiency First**: Every response must be concise and actionable. Avoid explanations unless explicitly requested. Focus on code changes, not commentary.

2. **Security by Default**: Never compromise security for convenience. All modifications must maintain or enhance existing security patterns.

3. **Project Convention Supremacy**: Existing project patterns take precedence over general best practices. Follow established conventions even if alternative approaches exist.

## Architectural Rules

### File Structure & Organization
- **ALWAYS** place files according to the established structure:
  - Pages → `src/app/(app)/[feature]/page.tsx`
  - API Routes → `src/app/api/[feature]/route.ts`
  - Components → `src/components/[feature]/[component].tsx`
  - Database functions → `supabase/migrations/[timestamp]_[feature].sql`
  - Auth logic → `src/auth/` only

- **NEVER** create files outside the established structure without explicit instruction

### Import Hierarchy
1. Use `@/*` alias for all internal imports
2. Group imports in this order:
   - React/Next.js core
   - Third-party libraries
   - Internal components (@/components)
   - Internal utilities (@/lib)
   - Types (@/types)
3. Never use relative imports beyond single-level (`./` only for same-directory files)

## Security & Authentication Rules

- **NEVER** trust `p_don_vi` from non-global users without sanitization
- **VALIDATE** every API route against session.role before processing

### Multi-Tenancy Enforcement
- **FILTER** all data queries by `current_don_vi` for non-global users
- **VALIDATE** tenant access in both RPC functions and API routes
- **PREVENT** cross-tenant data exposure through proper WHERE clauses
- **CHECK** session.don_vi matches requested resource tenant

### Database Access Patterns
- **ALWAYS** use Supabase RPC proxy (`/api/rpc/[fn]`) for database operations
- **NEVER** access Supabase tables directly from client or server
- **REQUIRE** all new RPC functions to:
  - Include tenant validation
  - Check role permissions
  - Be added to ALLOWED_FUNCTIONS whitelist
  - Have GRANT EXECUTE for authenticated role
- **SIGN** all RPC requests with SUPABASE_JWT_SECRET

## Code Quality Standards

### TypeScript Strict Mode
- **NEVER** use `any` type - find or create the correct type
- **EXPORT** explicit types for all public interfaces
- **DEFINE** return types for all functions
- **VALIDATE** props with proper TypeScript interfaces

### Error Handling
- **PARSE** error.details from RPC client as JSON
- **RETURN** `NextResponse.json({ error: string, details?: any })` from API routes
- **CATCH** and handle all async operations
- **VALIDATE** input early and fail fast
- **LOG** errors with context for debugging

### Performance Optimization
- **USE** `@tanstack/react-query` for all data fetching
- **MEMOIZE** expensive computations and heavy charts
- **IMPLEMENT** loading states for all async operations
- **DEFER** image loading (unoptimized for Cloudflare Workers)
- **CACHE** tenant lists and frequently accessed data

## UI/UX Consistency

### Component Patterns
- **USE** Radix UI primitives from `src/components` as base
- **STYLE** with Tailwind CSS only (no inline styles unless dynamic)
- **MAINTAIN** responsive design with list/card layouts
- **ENSURE** mobile-first approach for all new components

### Event Handling
- **STOP** propagation on row action buttons to prevent parent triggers
- **DEBOUNCE** search inputs and frequent API calls
- **PROVIDE** immediate feedback for user actions
- **DISABLE** submit buttons during processing

### Form Validation
- **VALIDATE** client-side for UX, server-side for security
- **DISPLAY** field-level errors immediately
- **PREVENT** submission of invalid forms
- **MAINTAIN** form state during errors

## Deployment & Build Rules

### Dual Deployment Compatibility
- **CHECK** feature compatibility with both Vercel and Cloudflare Workers
- **ADD** `export const runtime = 'nodejs'` when using Node-specific APIs
- **AVOID** Node.js-only packages when possible
- **TEST** with `CLOUDFLARE_WORKERS` flag when modifying build logic

### Environment Variables
- **NEVER** commit secrets to repository
- **REFERENCE** env vars with proper typing
- **VALIDATE** required env vars at startup
- **DOCUMENT** new env vars in .env.example

### Build Optimization
- **MINIMIZE** bundle size by using dynamic imports
- **TREE-SHAKE** unused code properly
- **OPTIMIZE** images and assets for web
- **ENABLE** PWA features where applicable

## Development Workflow

### Git Commit Practices
- **WRITE** clear, imperative mood commit messages
- **REFERENCE** issue numbers when applicable
- **SEPARATE** feature changes from refactoring
- **INCLUDE** migration files with schema changes

### Testing Requirements
- **CREATE** test files in `src/lib/__tests__/` for utilities
- **MOCK** external dependencies properly
- **TEST** error scenarios, not just happy paths
- **VALIDATE** multi-tenant isolation in tests

### Code Review Readiness
- **RUN** `npm run typecheck` before committing
- **SKIP** `npm run lint`
- **ENSURE** no console.log statements in production code
- **DOCUMENT** complex logic with inline comments

## Migration & Database Rules

### SQL Migration Standards
- **WRITE** idempotent migrations (safe to run multiple times)
- **USE** transactions for multi-step changes
- **INCLUDE** rollback procedures for destructive changes
- **GRANT** appropriate permissions after creating objects
- **PREFIX** files with timestamp: `YYYYMMDDHHMMSS_description.sql`
- DO NOT apply migrations (if any) automatically by Supabase MCP tools, just give me the migration script in the migrations folder and I will apply it manually by myself

### RPC Function Patterns
```sql
-- ALWAYS include these checks
CREATE OR REPLACE FUNCTION function_name(
  p_param1 TYPE,
  p_don_vi TEXT DEFAULT NULL
) 
RETURNS return_type
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_role TEXT;
  v_user_don_vi TEXT;
BEGIN
  -- Get user context
  v_user_role := current_setting('request.jwt.claims', true)::json->>'role';
  v_user_don_vi := current_setting('request.jwt.claims', true)::json->>'don_vi';
  
  -- Validate permissions
  IF v_user_role NOT IN ('allowed', 'roles') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;
  
  -- Tenant isolation
  IF v_user_role != 'global' THEN
    -- Enforce tenant boundary
  END IF;
  
  -- Business logic here
END;
$$;

GRANT EXECUTE ON FUNCTION function_name TO authenticated;
```

## Response Format Rules

### Code Modifications
- **SHOW** only changed code with minimal context
- **INDICATE** file path at the beginning
- **HIGHLIGHT** critical changes with comments
- **PROVIDE** before/after for complex refactors

### Problem Resolution
1. **IDENTIFY** root cause briefly
2. **IMPLEMENT** solution directly
3. **VALIDATE** fix addresses all aspects
4. **SUGGEST** preventive measures only if asked
5. **THINK** deeply first until you feel confident then code later. Note: ultilize human MCP tool such as: brain_think, brain_analyze, brain_reflect, ect. for sequential thinking.

### Feature Implementation
1. **CREATE** required files in order of dependency
2. **UPDATE** existing integration points
3. **ADD** necessary types and interfaces
4. **CONFIGURE** routing and permissions

## Prohibited Actions

**NEVER**:
- Access Supabase tables directly without RPC proxy
- Trust client-supplied authentication data
- Use `any` TypeScript type
- Create files outside project structure
- Modify core auth config without explicit instruction
- Deploy without running type and lint checks
- Store sensitive data in client-side code
- Bypass tenant isolation checks
- Ignore TypeScript errors with @ts-ignore
- Commit console.log statements

## Priority Hierarchy

When rules conflict, follow this priority:
1. **Security** - Never compromise authentication or data isolation
2. **Data Integrity** - Maintain consistency and validation
3. **Type Safety** - Enforce TypeScript strict mode
4. **Performance** - Optimize for user experience
5. **Maintainability** - Follow established patterns
6. **Features** - Implement new functionality

## Continuous Improvement

- **LEARN** from error patterns to prevent recurrence
- **ADAPT** responses based on frequently requested changes
- **MAINTAIN** consistency across all modifications
- **OPTIMIZE** for the most common use cases
- **DOCUMENT** decisions that deviate from standards

These rules are non-negotiable and must be followed for every code modification, regardless of the specific request.