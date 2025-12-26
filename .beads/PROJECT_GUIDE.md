# Beads Configuration Guide
## Vietnamese Medical Equipment Management System

## Configuration Summary

**Issue Prefix**: `qltbyt` (Quản Lý Thiết Bị Y Tế)
- Issues will be numbered: `qltbyt-1`, `qltbyt-2`, `qltbyt-3`, etc.

**Sync Branch**: `beads-sync`
- All issues are synced to this branch automatically
- Team members should pull this branch to get latest issues

## Beads Commands for This Project

### Issue Management
```bash
# Create a new issue (will be numbered qltbyt-N)
bd create "Fix equipment QR code scanner authentication"

# List all issues
bd list

# Show issue details
bd show qltbyt-1

# Update issue status
bd update qltbyt-1 --status in_progress
bd update qltbyt-1 --status done

# Assign priority
bd update qltbyt-1 --priority high

# Add tags
bd update qltbyt-1 --add-tag bug --add-tag urgent
```

### Sync with Git
```bash
# Sync issues to remote (commits to beads-sync branch)
bd sync

# Pull latest issues from remote
git pull origin beads-sync
```

### Issue Status Workflow
Recommended workflow for this project:

```
todo → in_progress → in_review → done
         ↓           ↓
       blocked     cancelled
```

## Project-Specific Issue Types

### Equipment (`equipment`)
- QR code issues
- Equipment lifecycle tracking
- Import/export functionality
- Filtering and search

### Maintenance (`maintenance`)
- Preventive maintenance scheduling
- Task management
- Calendar view issues
- Completion tracking

### Repairs (`repairs`)
- Repair request workflow
- Approval process
- Technician assignment
- Status tracking

### Transfers (`transfers`)
- Internal transfers (dept-to-dept)
- External transfers (tenant-to-tenant)
- Kanban board issues
- Approval workflows

### Users & Auth (`users`)
- RBAC issues
- Multi-tenant access
- Regional leader permissions
- Department restrictions

### Infrastructure (`infra`)
- Database migrations
- RPC functions
- API endpoints
- Performance optimization

### Security (`security`)
- Multi-tenant isolation
- Authentication/authorization
- SQL injection prevention
- XSS vulnerabilities

## Best Practices for This Project

### Issue Title Format
```
[type] brief description: context

Examples:
[equipment] Add bulk QR code generation: admin feature
[security] Fix tenant isolation in equipment_list RPC
[perf] Optimize equipment list query: 10k+ records
```

### Issue Priority Levels
- **critical**: Security vulnerabilities, data leaks, production outages
- **high**: Feature blockers, breaking changes
- **medium**: Important features, significant bugs
- **low**: Nice-to-have features, minor bugs

### Multi-Tenant Considerations
When creating issues related to data access:
- Always verify tenant isolation
- Check RPC function permission checks
- Validate role-based access control
- Test with multiple tenant contexts

### Integration with Development Workflow

1. **Before starting work**:
   ```bash
   bd create "Feature description"
   bd update qltbyt-X --status in_progress
   git checkout -b feature/qltbyt-X-feature-name
   ```

2. **During development**:
   ```bash
   # Commit as usual
   git add .
   git commit -m "implement feature"
   ```

3. **When done**:
   ```bash
   bd update qltbyt-X --status done
   bd sync  # Sync issue status to remote
   ```

4. **Session completion** (required by CLAUDE.md):
   ```bash
   bd sync
   git pull --rebase
   git push
   ```

## Environment Variables

Optional environment variables for local overrides:

```bash
# Override sync branch
export BEADS_SYNC_BRANCH="custom-branch"

# Override database location
export BEADS_DB="/path/to/custom.db"

# Set default actor for audit trails
export BD_ACTOR="developer-name"
```

## Troubleshooting

### Sync Issues
If `bd sync` fails:
```bash
# Check current branch
git branch

# Ensure beads-sync branch exists
git fetch origin beads-sync:beads-sync

# Reconcile merge conflicts in .beads/issues.jsonl
# Each line is a separate JSON object
```

### Database Issues
If database is corrupted:
```bash
# Export to JSONL
bd export

# Rebuild database from JSONL
rm .beads/beads.db
bd import
```

## Integration with CI/CD

Consider adding `bd sync` to your CI/CD pipeline for automatic issue tracking.

Example GitHub Actions step:
```yaml
- name: Sync Beads Issues
  run: |
    npm install -g @beads/bd
    bd sync
    git push origin beads-sync
```

## Resources

- **Beads Documentation**: https://github.com/steveyegge/beads
- **Quick Start**: Run `bd quickstart`
- **Help**: Run `bd --help` or `bd <command> --help`

---

**Last Updated**: 2025-12-26
**Project**: QLTBYT-Nam-Phong (Vietnamese Medical Equipment Management System)
