# Device Quota Feature Documentation

This directory contains all planning and design documents for the Device Quota (Định Mức Thiết Bị) feature.

## Document Index

| Document | Description | Status |
|----------|-------------|--------|
| [knowledge-2025.md](device-quota-knowledge-2025.md) | Updated regulations (Circular 46/2025, 08/2019, 01/2026) from NotebookLM research | Current |
| [implementation-plan.md](device-quota-implementation-plan.md) | Database schema, RPC functions, TypeScript types, TanStack hooks | Ready |
| [data-flow.md](device-quota-data-flow.md) | Architecture diagrams, security flow, role matrix, cache strategy | Ready |
| [claude-md-compliance.md](device-quota-claude-md-compliance.md) | CLAUDE.md rules checklist for implementation | Ready |
| [frontend-compliance-dashboard-review.md](device-quota-frontend-compliance-dashboard-review.md) | Compliance dashboard UI design from frontend agent | Ready |

## Legacy Documents (Outdated)

| Document | Notes |
|----------|-------|
| [compliance-plan.md](device-quota-compliance-plan.md) | Based on Circular 08/2019 - **superseded by knowledge-2025.md** |
| [ui-design.md](device-quota-ui-design.md) | Original UI concepts - **superseded by agent reviews** |

## Quick Links

### Regulations
- **Circular 46/2025/TT-BYT** (Primary) - Decentralizes quota authority to facility directors
- **Circular 08/2019/TT-BYT** - Calculation methodology (still valid)
- **Circular 01/2026/TT-BYT** - National centralized procurement

### Key Concepts
- Equipment hierarchy: `I → A → 1 → a` (Roman → Letter → Number → lowercase)
- Decision states: `draft → active → published` (immutable after publish)
- Compliance status: `đạt` (met), `thiếu` (below), `vượt` (exceeded)

### Implementation Phases
1. **Database** - Schema with ltree, triggers, audit log
2. **Backend** - RPC functions with tenant isolation
3. **Frontend** - Tree-table, decision workflow, compliance dashboard
4. **Testing** - Unit tests, accessibility audit

## Related Files (To Be Created)

```
src/app/(app)/device-quota/
├── _components/
│   ├── DeviceQuotaContext.tsx
│   ├── DeviceQuotaPageClient.tsx
│   ├── DeviceQuotaTable.tsx
│   ├── DeviceQuotaTreeTable.tsx
│   └── ... (see implementation-plan.md)
├── _hooks/
│   └── useDeviceQuotaContext.ts
├── page.tsx
└── types.ts
```

## Existing Files to Modify

| File | Changes |
|------|---------|
| `src/app/api/rpc/[fn]/route.ts` | Add 10 functions to ALLOWED_FUNCTIONS (~10 lines) |
| `src/types/database.ts` | Add quota interfaces (~80 lines) |

## Session History

- **2025-01-31**: NotebookLM research, backend agent reviews, frontend agent reviews, CLAUDE.md compliance check
