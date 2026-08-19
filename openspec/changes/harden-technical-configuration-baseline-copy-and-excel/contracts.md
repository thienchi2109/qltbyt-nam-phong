## Contract Scope

This file freezes the Phase 1 wire contract consumed by Phase 2. All functions return
`JSONB`, are allowlisted through the existing RPC proxy, and follow the module's
`admin/global`, `SECURITY DEFINER`, fixed `search_path`, explicit grant/revoke, and
fail-closed conventions.

## Source List

### Function

```sql
technical_configuration_baseline_cross_dossier_sources_list(
  p_target_dossier_id UUID,
  p_search TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 20
) RETURNS JSONB
```

### Validation And Ordering

- `p_page >= 1`.
- `p_page_size BETWEEN 1 AND 100`.
- `p_search` is trimmed; null/empty means no search. Non-empty search uses the deployed
  ILIKE sanitizer.
- Only `locked` baseline versions outside `p_target_dossier_id` are returned.
- Archived source dossiers are allowed and explicitly identified.
- Deterministic order:
  `locked_at DESC, dossier_name ASC, version_number DESC, baseline_version_id ASC`.

### Response

```json
{
  "data": [
    {
      "baseline_version_id": "uuid",
      "dossier_id": "uuid",
      "device_type_name": "text",
      "dossier_name": "text",
      "dossier_archived_at": "timestamptz|null",
      "version_number": 1,
      "locked_at": "timestamptz",
      "main_section_count": 0,
      "subgroup_count": 0,
      "criterion_count": 0
    }
  ],
  "total": 0,
  "page": 1,
  "page_size": 20
}
```

## Copy Preview

### Function

```sql
technical_configuration_baseline_cross_dossier_copy_preview(
  p_source_baseline_version_id UUID,
  p_target_dossier_id UUID,
  p_expected_dossier_revision BIGINT,
  p_expected_target_baseline_version_id UUID,
  p_expected_target_baseline_revision BIGINT
) RETURNS JSONB
```

The two expected target draft parameters are a pair: both null means the caller
observed no target draft; otherwise both are required. A mixed null/non-null pair is a
validation error.

### Response

```json
{
  "data": {
    "mode": "create|replace",
    "requires_replacement_confirmation": false,
    "preview_fingerprint": "sha256-hex",
    "source": {
      "baseline_version_id": "uuid",
      "dossier_id": "uuid",
      "device_type_name": "text",
      "dossier_name": "text",
      "dossier_archived_at": "timestamptz|null",
      "version_number": 1,
      "locked_at": "timestamptz"
    },
    "target": {
      "dossier_id": "uuid",
      "dossier_revision": 1,
      "baseline_version_id": "uuid|null",
      "baseline_revision": "number|null",
      "version_number": "number|null"
    },
    "copy_counts": {
      "main_sections": 0,
      "subgroups": 0,
      "criteria": 0,
      "reference_products": 0,
      "reference_responses": 0,
      "baseline_documents": 0,
      "baseline_citations": 0,
      "reference_documents": 0,
      "reference_citations": 0
    },
    "delete_counts": {
      "main_sections": 0,
      "subgroups": 0,
      "criteria": 0,
      "reference_products": 0,
      "reference_responses": 0,
      "baseline_documents": 0,
      "baseline_citations": 0,
      "reference_documents": 0,
      "reference_citations": 0,
      "option_responses": 0,
      "option_citations": 0,
      "manual_assessments": 0
    },
    "preserved_counts": {
      "suppliers": 0,
      "options": 0,
      "option_documents": 0,
      "comparison_sets": 0
    }
  }
}
```

Preview is read-only: it does not create a draft, delete dependent data, increment
revisions, or change audit metadata.

`preview_fingerprint` is a SHA-256 hex digest over a versioned canonical payload
containing source/target identity and revision plus deterministically ordered
identity/revision tuples for every row represented by `copy_counts`, `delete_counts`,
and `preserved_counts`. Tables without a revision column contribute their stable ID and
all mutable columns that affect copy, deletion, preservation, or user-visible counts.

## Copy Apply

### Function

```sql
technical_configuration_baseline_cross_dossier_copy_apply(
  p_source_baseline_version_id UUID,
  p_target_dossier_id UUID,
  p_expected_dossier_revision BIGINT,
  p_expected_target_baseline_version_id UUID,
  p_expected_target_baseline_revision BIGINT,
  p_preview_fingerprint TEXT,
  p_confirm_replace BOOLEAN
) RETURNS JSONB
```

Apply repeats every preview validation under target locks. `p_confirm_replace` must be
true when the current mode is `replace` and is ignored when the current mode is
`create`. Apply recomputes the canonical preview fingerprint under the same locks and
rejects `stale_preview` before mutation when it differs.

Apply lock order is normative:

1. lock the target dossier row through the existing revision guard;
2. acquire transaction-scoped `SHARE ROW EXCLUSIVE ... NOWAIT` locks in this order:
   `technical_configuration_baseline_versions`,
   `technical_configuration_baseline_groups`,
   `technical_configuration_baseline_subgroups`,
   `technical_configuration_baseline_criteria`,
   `technical_configuration_reference_products`,
   `technical_configuration_reference_responses`,
   `technical_configuration_baseline_documents`,
   `technical_configuration_baseline_citations`,
   `technical_configuration_reference_documents`,
   `technical_configuration_reference_citations`,
   `technical_configuration_suppliers`,
   `technical_configuration_options`,
   `technical_configuration_option_documents`,
   `technical_configuration_comparison_sets`,
   `technical_configuration_option_responses`,
   `technical_configuration_option_citations`,
   `technical_configuration_manual_assessments`;
3. recompute and compare `preview_fingerprint`;
4. perform replacement and return while retaining locks until transaction commit.

Because ordinary inserts, updates, and deletes take `ROW EXCLUSIVE` relation locks,
they cannot create phantom target rows after fingerprint validation. If any conflicting
relation lock already exists, apply catches `lock_not_available` and raises
`concurrent_write_retry` with `PT409` before mutation. A later writer waits until apply
commits. Because apply uses `NOWAIT`, it does not join a deadlock wait-cycle with
existing multi-table writers.

### Response

```json
{
  "data": {
    "mode": "create|replace",
    "target_dossier_id": "uuid",
    "target_dossier_revision": 1,
    "target_baseline_version_id": "uuid",
    "target_baseline_revision": 1,
    "source_baseline_version_id": "uuid",
    "copied_counts": {},
    "deleted_counts": {},
    "preserved_counts": {}
  }
}
```

The three count objects use the exact keys defined by preview.

## Stable Errors

| Message                           | SQLSTATE | Meaning                                                   |
| --------------------------------- | -------- | --------------------------------------------------------- |
| `validation_error`                | `PT422`  | Invalid pagination, UUID pair, search, or parameter shape |
| `not_found`                       | `PT404`  | Source baseline or target dossier is not visible/found    |
| `source_not_locked`               | `PT409`  | Source exists but is not locked                           |
| `source_matches_target_dossier`   | `PT422`  | Source belongs to the target dossier                      |
| `dossier_archived`                | `PT409`  | Target dossier is archived                                |
| `stale_revision`                  | `PT409`  | Target dossier or draft revision changed                  |
| `target_draft_changed`            | `PT409`  | Target draft identity differs from preview                |
| `stale_preview`                   | `PT409`  | Copied/deleted/preserved snapshot differs from preview    |
| `concurrent_write_retry`          | `PT409`  | A conflicting writer holds a required table lock          |
| `replacement_confirmation_needed` | `PT409`  | Existing draft requires `p_confirm_replace = true`        |

Missing/invalid JWT claims and unauthorized roles use the existing module-wide
insufficient-privilege contract and do not reveal whether source or target data exists.
