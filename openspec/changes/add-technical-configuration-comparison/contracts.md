# Technical Configuration Comparison Contract Pack

## P0 Baseline

- Feature baseline SHA: `6b5404f70eeee51026de23eddb6a55c07acdb7c7`
- P0 scope: documentation and read-only discovery only.
- No production code, migration file or live database write belongs to P0.
- P1 may start only after this contract pack is merged and verified on `main`.

## Global Invariants

1. A dossier is the aggregate root and the single configuration lineage for one device type. There is no separate lineage table.
2. A dossier has zero or more locked baseline versions and at most one editable draft.
3. Archived dossiers are hidden from default lists, remain readable and reject every descendant mutation. MVP has no restore operation.
4. Locked baseline-owned data is immutable for every role, including `global` and raw `admin`.
5. Direct Data API access to module tables is denied. Reads and writes use guarded `SECURITY DEFINER` RPCs.
6. Every editable aggregate has `revision BIGINT NOT NULL`. Every mutation requires `p_expected_revision`.
7. Criterion codes are system-generated, unique per baseline version and stable across reorder/copy.
8. Suppliers belong to one dossier and are shared only by options in that dossier.
9. A dossier may contain unlimited options. One matrix request selects at most 8 options and reads at most 100 criteria.
10. MVP adds no AI runtime table, column, RPC, job, cache, quota, API call or UI affordance.

## Entity And Migration Ownership

Each entity or schema alteration has one primary leaf owner. A later leaf may extend an existing copy/guard function only when its own entities require that extension.

| Leaf | Entity or alteration                          | Key ownership and cascade contract                                                                                            |
| ---- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| P1   | `technical_configuration_dossiers`            | UUID root; device type/name/description; archive and audit metadata; `revision`; no hard-delete RPC                           |
| P2   | `technical_configuration_baseline_versions`   | FK `dossier_id`; partial unique draft per dossier; sequential version number; `next_criterion_number`; audit/revision         |
| P2   | `technical_configuration_baseline_groups`     | FK baseline version; ordered editable seed records; delete cascades only inside an editable version transaction               |
| P2   | `technical_configuration_baseline_criteria`   | FK group/version; system code unique per version; optional title; multiline text; order; `source_criterion_id` initially null |
| P4   | baseline lifecycle alterations                | Adds lock metadata, `source_baseline_version_id`, copy/lock functions and locked mutation guard                               |
| P7A  | `technical_configuration_reference_products`  | FK exact baseline version; zero-to-many; excluded from supplier/ranking domains                                               |
| P7A  | `technical_configuration_reference_responses` | Unique reference product + criterion; cascade with reference product/version                                                  |
| P7B  | `technical_configuration_baseline_documents`  | FK exact baseline version; URL metadata only                                                                                  |
| P7B  | `technical_configuration_baseline_citations`  | FK baseline document + criterion in the same version                                                                          |
| P7B  | `technical_configuration_reference_documents` | FK reference product; URL metadata only                                                                                       |
| P7B  | `technical_configuration_reference_citations` | FK reference document + criterion in the reference product's version                                                          |
| P8A  | `technical_configuration_suppliers`           | FK dossier; normalized name unique per dossier                                                                                |
| P8A  | `technical_configuration_options`             | FK supplier and dossier-consistent ownership; directly editable                                                               |
| P8A  | `technical_configuration_comparison_sets`     | FK option + exact baseline version; one active response dataset per pair                                                      |
| P8A  | `technical_configuration_option_responses`    | Unique comparison set + criterion; response and supplementary text remain separate                                            |
| P9B  | `technical_configuration_option_documents`    | FK option; URL metadata only                                                                                                  |
| P9B  | `technical_configuration_option_citations`    | FK option document + criterion through the matching comparison set                                                            |
| P11  | `technical_configuration_manual_assessments`  | Unique comparison set + criterion; two axes, notes, evaluator metadata and revision                                           |

All tables include UUID primary keys and the audit columns required by `design.md`. Foreign keys must prevent cross-dossier and cross-version relationships even when a caller bypasses the UI.

## State And Identity Contracts

### Dossier

- Active: readable and mutable subject to role/revision/leaf guards.
- Archived: readable, excluded from default list and immutable.
- Archive is one-way in MVP; no restore RPC exists.
- `technical_configuration_dossiers_archive` increments dossier revision atomically.

P1 creates `technical_configuration_dossiers` with:

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- required trimmed non-empty `device_type_name TEXT`
- required trimmed non-empty `name TEXT`
- optional `description TEXT`
- `revision BIGINT NOT NULL DEFAULT 1`
- nullable `archived_at TIMESTAMPTZ` and `archived_by BIGINT`
- `created_at`, `created_by`, `updated_at` and `updated_by` audit columns

P1 RPC signatures are frozen as:

```text
technical_configuration_dossiers_list(
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 20,
  p_include_archived BOOLEAN DEFAULT false
)
technical_configuration_dossiers_get(p_id UUID)
technical_configuration_dossiers_create(
  p_device_type_name TEXT,
  p_name TEXT,
  p_description TEXT,
  p_expected_revision BIGINT
)
technical_configuration_dossiers_update(
  p_id UUID,
  p_device_type_name TEXT,
  p_name TEXT,
  p_description TEXT,
  p_expected_revision BIGINT
)
technical_configuration_dossiers_archive(
  p_id UUID,
  p_expected_revision BIGINT
)
```

Create requires `p_expected_revision=0` and returns revision `1`. Update and archive require the current dossier revision and increment it atomically. P1 adds no hard-delete or restore RPC.

### Baseline Version

- States: `draft`, `locked`.
- A partial unique constraint enforces at most one `draft` row per dossier.
- A dossier may retain any number of `locked` rows.
- Lock requires at least one group, one non-empty criterion, unique codes and no unresolved import error.
- Lock records `locked_at` and `locked_by` and increments revision.

### Criterion Code

- Format: `TC-` plus at least four zero-padded digits, beginning at `TC-0001`.
- Scope: unique within one baseline version.
- Source: generated only by the backend; users cannot enter or edit it.
- Allocation: atomically reserve `next_criterion_number`, then increment it in the same transaction.
- Delete: does not decrement the counter or automatically reuse a number.
- Reorder: never changes the code.
- Copy: preserves codes and the source version's next counter; copied criteria receive new IDs and `source_criterion_id`.
- Excel: existing rows must preserve their code; new rows leave the code blank until preview/apply.

### Supplier Name

`normalized_name` is computed by trimming leading/trailing whitespace, collapsing consecutive whitespace to one space and lowercasing. It is unique by `(dossier_id, normalized_name)`. The same normalized name may exist in another dossier.

## Locked Baseline Copy Contract

`technical_configuration_baseline_copy` creates a new draft in one transaction.

- Reject when the source is not locked.
- Reject with `draft_already_exists` when the dossier already has a draft.
- Require the source baseline version's current `p_expected_revision`.
- Create new IDs for every copied row.
- Set `source_baseline_version_id` on the new version.
- Preserve criterion codes and set `source_criterion_id` on copied criteria.
- Remap every child relationship to the newly created IDs.
- Copy groups and criteria in P4.
- Extend the same RPC in P7A to copy reference products and reference responses.
- Extend the same RPC in P7B to copy baseline/reference documents and citations.
- Never copy suppliers, options, comparison sets, option responses, option documents/citations or manual assessments.

Each migration that extends this function must sort after the latest local migration that defines it.

## Authorization And Guard Contracts

### Role Matrix

| Session state                                      | Read             | Mutate active data                    | Mutate archived/locked data |
| -------------------------------------------------- | ---------------- | ------------------------------------- | --------------------------- |
| `global`                                           | allow            | allow with revision/validation guards | deny                        |
| raw `admin`                                        | same as `global` | same as `global`                      | deny                        |
| `regional_leader`, `technician`, `to_qltb`, `user` | deny             | deny                                  | deny                        |
| missing/empty role or user ID claim                | deny fail-closed | deny fail-closed                      | deny fail-closed            |

Outside the RPC proxy, raw `admin` handling uses `isGlobalRole()`. SQL tests may use an existing global user ID while setting `app_role=admin`.

### Common SQL Guards

- `_technical_configuration_require_global_user()` validates role and non-empty user ID claims, normalizes `admin` to global semantics and returns the actor ID.
- `_technical_configuration_require_editable_dossier(p_dossier_id uuid, p_expected_revision bigint)` calls the role guard, locks the dossier, verifies existence, archive state and revision, then returns the actor ID.
- P4 owns `_technical_configuration_require_editable_baseline_version(p_baseline_version_id uuid)`, which calls the dossier guard and raises `locked_version` when needed.

Every descendant mutation leaf must call the most specific applicable guard. A leaf may not duplicate or weaken these checks.

### Table Exposure

Every module table starts with:

```sql
REVOKE ALL ON TABLE public.<table_name> FROM anon, authenticated, public;
```

Sequences receive no direct Data API grants. RPC execution is granted only as required, and every `SECURITY DEFINER` function sets `search_path = public, pg_temp`.

## RPC Contract

### Naming

RPC names use:

```text
technical_configuration_<aggregate>_<verb>
```

SQL parameters use `p_`-prefixed `snake_case`. Wire result fields use database `snake_case`; the module-local TypeScript adapter may map them to domain types.

### Primary RPC Ownership

| Leaf | RPCs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1   | `technical_configuration_dossiers_list`, `technical_configuration_dossiers_get`, `technical_configuration_dossiers_create`, `technical_configuration_dossiers_update`, `technical_configuration_dossiers_archive`                                                                                                                                                                                                                                                                                                                                                                              |
| P2   | `technical_configuration_baseline_draft_create`, `technical_configuration_baseline_draft_get`, `technical_configuration_baseline_group_create`, `technical_configuration_baseline_group_update`, `technical_configuration_baseline_group_delete`, `technical_configuration_baseline_groups_reorder`, `technical_configuration_baseline_criterion_create`, `technical_configuration_baseline_criterion_update`, `technical_configuration_baseline_criterion_delete`, `technical_configuration_baseline_criteria_reorder`, `technical_configuration_baseline_bulk_preview`                       |
| P4   | `technical_configuration_baseline_versions_list`, `technical_configuration_baseline_lock`, `technical_configuration_baseline_copy`                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| P5C  | `technical_configuration_baseline_import_preview`, `technical_configuration_baseline_import_apply`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| P7A  | `technical_configuration_reference_products_list`, `technical_configuration_reference_product_create`, `technical_configuration_reference_product_update`, `technical_configuration_reference_product_delete`, `technical_configuration_reference_response_upsert`                                                                                                                                                                                                                                                                                                                             |
| P7B  | `technical_configuration_baseline_documents_list`, `technical_configuration_baseline_document_create`, `technical_configuration_baseline_document_update`, `technical_configuration_baseline_document_delete`, `technical_configuration_baseline_citation_upsert`, `technical_configuration_baseline_citation_delete`, `technical_configuration_reference_document_create`, `technical_configuration_reference_document_update`, `technical_configuration_reference_document_delete`, `technical_configuration_reference_citation_upsert`, `technical_configuration_reference_citation_delete` |
| P8A  | `technical_configuration_suppliers_list`, `technical_configuration_supplier_create`, `technical_configuration_supplier_update`, `technical_configuration_supplier_delete`, `technical_configuration_options_list`, `technical_configuration_option_create`, `technical_configuration_option_update`, `technical_configuration_option_delete`, `technical_configuration_comparison_set_get_or_create`, `technical_configuration_option_response_upsert`                                                                                                                                         |
| P9B  | `technical_configuration_option_documents_list`, `technical_configuration_option_document_create`, `technical_configuration_option_document_update`, `technical_configuration_option_document_delete`, `technical_configuration_option_citation_upsert`, `technical_configuration_option_citation_delete`                                                                                                                                                                                                                                                                                      |
| P10A | `technical_configuration_comparison_get`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| P11  | `technical_configuration_assessments_list`, `technical_configuration_assessment_upsert`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

Each leaf that introduces an RPC owns allowlisting only the names introduced by that leaf. P3A owns the module-local typed client used by all module RPCs. Shared `callRpc()` remains unchanged because its current consumers depend on the existing plain-`Error` behavior.

### Request And Response Shapes

- List request: `p_page >= 1`, `1 <= p_page_size <= 100`, optional leaf-specific filters.
- Dossier list defaults `p_include_archived=false`.
- List response wire shape: `{ data, total, page, page_size }`.
- Get/create/update/archive/copy/upsert response: `{ data }`.
- Delete response: `{ data: { id, revision } }`.
- Preview response: `{ data, errors }`; preview does not persist.
- Baseline import preview/apply request: `p_baseline_version_id`, `p_template_metadata JSONB`, `p_rows JSONB`, `p_expected_revision`.
- Baseline import apply response: `{ data }`, where `data` is the complete updated baseline snapshot and owning revision.
- Every mutation request includes `p_expected_revision`. Dossier create requires `0`; descendant creates use the owning aggregate revision.
- A successful mutation returns the new revision in `data`.

### Error Taxonomy

RPCs raise the SQLSTATE and machine message below. The proxy's `{ error: payload }` envelope and upstream HTTP status are preserved by the module adapter together with `code`, `message`, `details` and `hint`.

| SQLSTATE | Message                | Primary leaf | Meaning                                                             |
| -------- | ---------------------- | ------------ | ------------------------------------------------------------------- |
| `42501`  | `permission_denied`    | P1           | Missing/invalid claims or unauthorized role                         |
| `PT404`  | `not_found`            | P1           | Requested dossier/entity is absent or outside the owner scope       |
| `PT409`  | `stale_revision`       | P1           | `p_expected_revision` does not match current revision               |
| `PT409`  | `archived_dossier`     | P1           | Mutation targets an archived dossier or descendant                  |
| `PT409`  | `locked_version`       | P4           | Mutation targets locked baseline-owned data                         |
| `PT409`  | `draft_already_exists` | P2           | Dossier already has an editable draft                               |
| `PT422`  | `validation_error`     | P1           | Field, relationship, order, code or request-bound validation failed |
| `PT422`  | `template_mismatch`    | P5C          | Workbook kind/version/metadata/shape does not match the contract    |

Errors must not include dossier data when authorization or ownership fails.

## Excel Contract

### Shared Infrastructure Reuse

P5A owns the shared Excel seams already exercised by the Equipment page:

- workbook creation/loading and worksheet value conversion
- Blob download and object-URL cleanup
- `useBulkImportState` file/parse/error lifecycle with an optional custom workbook parser
- `BulkImportDialogParts` file input, parse errors, row errors and submit state

Equipment and existing bulk-import consumers keep their public behavior and compatibility exports. `exportToExcel` remains the flat visible-sheet export API; it is not extended with baseline-specific flags for hidden metadata, row types or import semantics. P5B adds only the baseline workbook codec on top of the shared primitives. P5D must not create parallel workbook loading, download, file-input state, error-list or submit-state helpers.

### Baseline Workbook Version 1

- Exactly one visible data sheet named `Baseline`.
- Exactly one hidden metadata sheet named `_meta`.
- No additional visible or hidden sheet or content column.

Visible columns, in order:

1. `row_type`
2. `group_order`
3. `group_name`
4. `criterion_order`
5. `criterion_code`
6. `criterion_title`
7. `requirement_text`

`row_type` is `GROUP` or `CRITERION`. Group rows define editable groups. Criterion rows belong to the preceding/current group order. Existing criterion codes are read-only and must match the target version. New criterion rows have blank codes.

`_meta` contains:

- `template_kind=technical_configuration_baseline`
- `template_version=1`
- `dossier_id`
- `baseline_version_id`
- `baseline_revision`
- `generated_at`

Import parses and previews the whole workbook before mutation. Structural or row errors reject the entire apply; no partial write occurs.

### Baseline Import Preview And Apply

P5C introduces:

```text
technical_configuration_baseline_import_preview(
  p_baseline_version_id uuid,
  p_template_metadata jsonb,
  p_rows jsonb,
  p_expected_revision bigint
)

technical_configuration_baseline_import_apply(
  p_baseline_version_id uuid,
  p_template_metadata jsonb,
  p_rows jsonb,
  p_expected_revision bigint
)
```

Both RPCs call the same internal server-side validator/normalizer. Both reject malformed canonical rows and metadata whose `template_kind`, `template_version`, `dossier_id`, `baseline_version_id` or `baseline_revision` does not match the target. Preview is read-only and returns canonical rows, provisional codes and row-level errors. Apply acquires the established dossier-row then baseline-row lock order, repeats validation under lock and rejects stale, archived or locked targets before mutation.

Existing criteria are matched by immutable `criterion_code` and retain their criterion IDs and `source_criterion_id`. New criterion rows must have blank codes and receive codes from the target version's `next_criterion_number` during the apply transaction. The counter advances exactly once per newly allocated criterion and never for an existing row. The canonical group/criterion tree is reconciled as one aggregate mutation, the owning revision increments once, and any failure rolls back every change.

The client must not translate workbook rows into the existing sequential group/criterion CRUD save steps. Import files, parsed rows, previews and errors remain transient client state; P5C and P5D create no import-error table or persisted upload record.

## Query And Performance Budgets

- Dossier and entity lists use bounded pagination with a maximum page size of 100.
- `technical_configuration_comparison_get` accepts 1-8 option IDs from one dossier and one baseline version.
- It returns at most 100 ordered criteria per request and supports criterion pagination.
- A ninth option remains available for another request; total dossier option count is unlimited.
- The matrix payload is fetched through one bounded RPC. Supplier labels, responses, supplementary information and citation summaries must not trigger N+1 queries.
- P10A performance verification uses 500 criteria, 50 total options and 8 selected options, with representative `EXPLAIN` review.

## Migration Order

1. P1 creates dossier/auth/archive helpers.
2. P2 creates baseline draft/version/group/criterion contracts.
3. P4 adds lock/history/source links and the core copy function.
4. P5C adds baseline import preview/apply functions without creating a new persistence table.
5. P7A adds reference entities and extends copy.
6. P7B adds baseline/reference documents/citations and extends copy again.
7. P8A adds suppliers/options/comparison sets/responses.
8. P9B adds option documents/citations.
9. P10A adds the bounded comparison read contract when a dedicated RPC is required.
10. P11 adds manual assessments.

P5A, P5B and P5D create no technical-configuration persistence. P6 also creates no technical-configuration persistence; it lands after P5D and before the first document UI in P7B. Migration timestamps are selected at leaf execution time after checking all local migrations touching the same functions/tables.

## AI Boundary Audit

Schema and code review for every leaf must confirm absence of AI result/cache/job/quota fields and runtime calls. Stable IDs, criterion-scoped evidence and separated manual assessments are compatibility boundaries only.
