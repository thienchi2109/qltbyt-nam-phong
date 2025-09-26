# Database Workflow Rules - QLTBYT Nam Phong

## MCP Database Tool Usage

### Supabase MCP Tool Guidelines
- **ALWAYS** use Supabase MCP tools (`list_tables`, `execute_sql`, `list_migrations`, etc.) when you need to evaluate or get more information about the database schema/migrations
- **USE** these tools for inspection, analysis, and understanding current database state
- **LEVERAGE** MCP tools for schema exploration, debugging, and planning

### Migration Script Handling
- **NEVER** run SQL scripts automatically via MCP tools (this is a security safeguard)
- **ALWAYS** provide necessary SQL migration scripts in the `D:\qltbyt-nam-phong\supabase\migrations\` directory
- **FORMAT** migration files as: `YYYYMMDDHHMMSS_descriptive_name.sql`
- **INCLUDE** proper rollback procedures and documentation in migration files

### Database Operation Workflow
1. **Analyze**: Use MCP tools to understand current schema and identify requirements
2. **Plan**: Create migration strategy based on existing patterns and project conventions  
3. **Generate**: Provide complete SQL migration scripts for manual review and application
4. **Document**: Include clear comments and rollback procedures in all migrations

### Security & Compliance
- **FOLLOW** existing RPC-only security model (no direct table access)
- **MAINTAIN** tenant isolation and role-based access patterns
- **VALIDATE** all new functions follow SECURITY DEFINER with proper role checks
- **ENSURE** search_path hardening on all new database functions

These rules supplement the existing comprehensive rule system and maintain the project's security-first, convention-driven approach to database operations.

*Last Updated: September 26, 2025*