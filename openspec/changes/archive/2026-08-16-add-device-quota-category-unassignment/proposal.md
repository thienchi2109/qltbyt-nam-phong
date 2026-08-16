# Change: Add Device Quota Category Unassignment

## Why

The assigned-equipment detail on the Device Quota **Danh mục & Phân loại** workspace is
currently read-only. Authorized users can assign equipment to a category, but they
cannot correct an existing assignment from the same workspace, leaving
misclassified equipment and derived category/compliance counts in place.

The database already has an audited unlink operation, but its current contract does
not verify that an equipment item still belongs to the category shown in the user's
possibly stale UI. The frontend also needs an explicit cache policy so a successful
single-row correction does not trigger unnecessary read requests.

## What Changes

- Add a trailing per-row unlink action to directly assigned equipment. The action
  uses a familiar Lucide `X` icon, the exact accessible label and tooltip
  `Bỏ khỏi danh mục`, and a confirmation dialog identifying the equipment and
  selected category.
- Keep unassignment restricted to the existing equipment-manager roles:
  `global`, `admin`, and `to_qltb`.
- Return unlinked equipment to the unassigned pool even when the resulting category
  count is below its configured minimum; compliance state reflects the new count.
- Limit parent-category actions to equipment assigned directly to that parent.
- **BREAKING (RPC overload):** replace the unsafe two-argument
  `dinh_muc_thiet_bi_unlink` overload with an expected-category contract so stale
  UI cannot unlink an assignment that was concurrently moved elsewhere.
- Cancel matching in-flight reads, update TanStack Query caches deterministically
  after the mutation, and mark related queries stale without immediate refetch when
  no authoritative read is needed.
- Deliver implementation through reviewable phases with explicit deploy-safe
  boundaries for characterization, database contract, UI shell, cache
  reconciliation, verification, and rollout.

## Impact

- Affected specs: `device-quota-category-workspace`
- Affected frontend:
  - assigned-equipment row rendering and action isolation
  - confirmation-dialog composition
  - device-quota unlink mutation and TanStack Query cache reconciliation
  - focused role, hierarchy, concurrency, and request-count tests
- Affected backend:
  - a new ordered Supabase migration replacing the unsafe unlink overload
  - source-contract and RPC proxy allowlist coverage
- Live database: no write is authorized by this proposal. Applying the migration
  requires separate explicit maintainer approval and must use Supabase MCP.

## Wayfinder Traceability

- Map: https://github.com/thienchi2109/qltbyt-nam-phong/issues/928
- Source decision: https://github.com/thienchi2109/qltbyt-nam-phong/issues/929
- Decision status: Resolved
- Promoted on: 2026-08-15
