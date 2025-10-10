# Serena Onboarding Summary

## Onboarding Date
October 10, 2025

## Project Status
✅ **Successfully Onboarded to Serena MCP**

## Memories Created
1. **project_overview_and_architecture** - Core technology stack, architecture patterns, file structure
2. **current_issues_and_status** - P0 repair requests crash, recent work, equipment page behavior
3. **code_patterns_and_conventions** - RPC templates, API patterns, import orders, error handling
4. **session_2025-10-02_login_improvements** - Previous session work on login UI and database setup

## Key Understanding Achieved

### Critical Security Patterns
- RPC-only data access via `/api/rpc/[fn]` proxy
- JWT-signed claims for all database operations
- Multi-tenant isolation enforced at RPC level
- Never trust client-supplied role/tenant data

### Current Work Focus
- **P0 Issue**: Repair Requests page crash for regional_leader role
- **Root Cause**: 4 critical issues identified in filtering logic
- **Fix Plan**: 3-phase approach (Immediate → Medium → Long-term)

### Development Workflow
- Manual SQL execution in Supabase SQL Editor
- Migrations committed to `supabase/migrations/`
- Typecheck mandatory before commits
- Dual deployment (Vercel + Cloudflare)

## Serena Operational Mode
- **Context**: ide-assistant
- **Modes**: interactive, editing
- **Tools**: 24 active tools for symbol management, file operations, and code editing

## Next Steps Ready
1. Can immediately address repair requests crash fix
2. Can create/modify RPC functions following established patterns
3. Can edit TypeScript files using symbol-based tools
4. Can review and update database migrations
5. Can read comprehensive documentation in `docs/`

## Important Files Mapped
- Auth: `src/auth/config.ts`
- RPC Proxy: `src/app/api/rpc/[fn]/route.ts`
- Middleware: `src/middleware.ts`
- RPC Client: `src/lib/rpc-client.ts`
- Supabase: `src/lib/supabase.ts`

## Documentation Available
- 47 markdown files in `docs/`
- Architecture blueprints
- Deployment guides
- Session notes
- Issue tracking

## Ready for Task Assignment
Serena is now fully configured and ready to:
- Fix bugs using symbol-based editing
- Create new features following project patterns
- Review and refactor existing code
- Generate database migrations
- Navigate codebase efficiently with semantic tools
