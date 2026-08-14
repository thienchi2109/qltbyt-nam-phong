-- P6C live acceptance for revise-technical-configuration-baseline-hierarchy.
-- Run only through Supabase MCP after explicit authorization for this exact write.
-- The nested block is a PL/pgSQL subtransaction. Both successful and failed smoke
-- attempts roll back before fixture-scoped residue checks run.

DO $p6c$
DECLARE
  v_user_id BIGINT;
  v_source_version_id UUID;
  v_source_dossier_id UUID;
  v_source_revision BIGINT;
  v_source_snapshot_before JSONB;
  v_source_lock JSONB;
  v_source_lock_snapshot JSONB;
  v_source_lock_revision BIGINT;
  v_source_criterion_id UUID;
  v_copy_response JSONB;
  v_copy_version_id UUID;
  v_copy_dossier_id UUID;
  v_copy_revision BIGINT;
  v_copy_snapshot_before_lock JSONB;
  v_metadata JSONB;
  v_rows JSONB;
  v_preview JSONB;
  v_apply JSONB;
  v_apply_snapshot JSONB;
  v_apply_revision BIGINT;
  v_lock JSONB;
  v_lock_snapshot JSONB;
  v_expected_group_count BIGINT;
  v_smoke_completed BOOLEAN := false;
  v_stage TEXT := 'preflight';
  v_failure_state TEXT;
  v_failure_message TEXT;
  v_failure_stage TEXT;
  v_failure_detail TEXT;
  v_failure_context TEXT;
BEGIN
  BEGIN
    SELECT
      version_row.created_by,
      version_row.id,
      version_row.dossier_id,
      version_row.revision,
      (
        SELECT count(*)
        FROM public.technical_configuration_baseline_groups group_row
        WHERE group_row.baseline_version_id = version_row.id
      )
    INTO
      v_user_id,
      v_source_version_id,
      v_source_dossier_id,
      v_source_revision,
      v_expected_group_count
    FROM public.technical_configuration_baseline_versions version_row
    JOIN public.nhan_vien user_row
      ON user_row.id = version_row.created_by
     AND user_row.role IN ('global', 'admin')
     AND user_row.is_active
    WHERE version_row.status = 'draft'
      AND (
        SELECT count(*)
        FROM public.technical_configuration_baseline_groups group_row
        WHERE group_row.baseline_version_id = version_row.id
      ) BETWEEN 1 AND 4
      AND NOT EXISTS (
        SELECT 1
        FROM public.technical_configuration_baseline_subgroups subgroup_row
        WHERE subgroup_row.baseline_version_id = version_row.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.technical_configuration_baseline_criteria criterion_row
        WHERE criterion_row.baseline_version_id = version_row.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.technical_configuration_baseline_documents document_row
        WHERE document_row.baseline_version_id = version_row.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.technical_configuration_baseline_citations citation_row
        WHERE citation_row.baseline_version_id = version_row.id
      )
    ORDER BY version_row.updated_at DESC, version_row.id
    LIMIT 1
    FOR SHARE OF version_row;

    IF v_source_version_id IS NULL THEN
      RAISE EXCEPTION 'P6C requires an empty representative global-owned draft';
    END IF;

    PERFORM set_config(
      'request.jwt.claims',
      jsonb_build_object(
        'app_role', 'global',
        'role', 'authenticated',
        'user_id', v_user_id::TEXT,
        'sub', v_user_id::TEXT
      )::TEXT,
      true
    );

    v_source_snapshot_before :=
      public._technical_configuration_baseline_snapshot(v_source_version_id);

    v_stage := 'payload';

    WITH ordered_groups AS (
      SELECT
        group_row.id,
        group_row.name,
        row_number() OVER (ORDER BY group_row.sort_order, group_row.id) AS sequence
      FROM public.technical_configuration_baseline_groups group_row
      WHERE group_row.baseline_version_id = v_source_version_id
    ),
    raw_rows AS (
      SELECT
        ordered_group.sequence * 10 AS order_key,
        jsonb_build_object(
          'stt',
          CASE ordered_group.sequence
            WHEN 1 THEN 'I'
            WHEN 2 THEN 'II'
            WHEN 3 THEN 'III'
            WHEN 4 THEN 'IV'
          END,
          'content', ordered_group.name,
          'group_id', ordered_group.id,
          'subgroup_id', NULL,
          'criterion_id', NULL,
          'criterion_code', NULL
        ) AS payload
      FROM ordered_groups ordered_group

      UNION ALL

      SELECT
        11,
        jsonb_build_object(
          'stt', '1',
          'content', 'P6C live acceptance subgroup',
          'group_id', NULL,
          'subgroup_id', NULL,
          'criterion_id', NULL,
          'criterion_code', NULL
        )

      UNION ALL

      SELECT
        12,
        jsonb_build_object(
          'stt', NULL,
          'content', 'P6C live acceptance criterion',
          'group_id', NULL,
          'subgroup_id', NULL,
          'criterion_id', NULL,
          'criterion_code', NULL
        )
    ),
    numbered_rows AS (
      SELECT
        row_number() OVER (ORDER BY raw_row.order_key) + 1 AS sheet_row,
        raw_row.payload
      FROM raw_rows raw_row
    )
    SELECT jsonb_agg(
      numbered_row.payload || jsonb_build_object('row', numbered_row.sheet_row)
      ORDER BY numbered_row.sheet_row
    )
    INTO v_rows
    FROM numbered_rows numbered_row;

    v_metadata := jsonb_build_object(
      'template_kind', 'technical_configuration_baseline',
      'template_version', 2,
      'dossier_id', v_source_dossier_id,
      'baseline_version_id', v_source_version_id,
      'baseline_revision', v_source_revision,
      'generated_at', clock_timestamp()
    );

    v_stage := 'preview';

    SELECT public.technical_configuration_baseline_import_preview_v2(
      v_source_version_id,
      v_metadata,
      v_rows,
      v_source_revision
    )
    INTO v_preview;

    IF jsonb_array_length(v_preview->'errors') <> 0
       OR v_preview#>'{data,effects}' IS NULL THEN
      RAISE EXCEPTION 'P6C XLSX v2 preview failed: %', v_preview;
    END IF;

    v_stage := 'apply';

    SELECT public.technical_configuration_baseline_import_apply_v2(
      v_source_version_id,
      v_metadata,
      v_rows,
      v_source_revision
    )
    INTO v_apply;

    v_stage := 'apply_constraints';

    SET CONSTRAINTS ALL IMMEDIATE;

    v_apply_snapshot := v_apply->'data';

    v_stage := 'apply_parity';

    IF v_apply->'preview' IS DISTINCT FROM v_preview->'data'
       OR v_apply_snapshot IS DISTINCT FROM
          public._technical_configuration_baseline_snapshot(v_source_version_id) THEN
      RAISE EXCEPTION 'P6C XLSX v2 apply parity failed: %', v_apply;
    END IF;

    v_apply_revision := (v_apply_snapshot->>'revision')::BIGINT;

    v_stage := 'apply_contract';

    IF v_apply_revision IS NULL
       OR v_apply_revision <= v_source_revision
       OR (
         SELECT count(*)
         FROM public.technical_configuration_baseline_groups group_row
         WHERE group_row.baseline_version_id = v_source_version_id
       ) IS DISTINCT FROM v_expected_group_count
       OR (
         SELECT count(*)
         FROM public.technical_configuration_baseline_subgroups subgroup_row
         WHERE subgroup_row.baseline_version_id = v_source_version_id
       ) IS DISTINCT FROM 1::BIGINT
       OR (
         SELECT count(*)
         FROM public.technical_configuration_baseline_criteria criterion_row
         WHERE criterion_row.baseline_version_id = v_source_version_id
       ) IS DISTINCT FROM 1::BIGINT THEN
      RAISE EXCEPTION 'P6C imported hierarchy contract failed: %', v_apply;
    END IF;

    SELECT criterion_row.id
    INTO v_source_criterion_id
    FROM public.technical_configuration_baseline_criteria criterion_row
    WHERE criterion_row.baseline_version_id = v_source_version_id
      AND criterion_row.requirement_text = 'P6C live acceptance criterion'
    LIMIT 1;

    IF v_source_criterion_id IS NULL THEN
      RAISE EXCEPTION 'P6C source criterion identity missing after apply';
    END IF;

    v_stage := 'source_lock';

    SELECT public.technical_configuration_baseline_lock(
      v_source_version_id,
      v_apply_revision
    )
    INTO v_source_lock;

    v_source_lock_snapshot := v_source_lock->'data';
    v_source_lock_revision := (v_source_lock_snapshot->>'revision')::BIGINT;

    IF v_source_lock_snapshot->>'status' IS DISTINCT FROM 'locked'
       OR v_source_lock_revision IS NULL
       OR v_source_lock_revision <= v_apply_revision
       OR v_source_lock_snapshot->'groups' IS DISTINCT FROM
          v_apply_snapshot->'groups' THEN
      RAISE EXCEPTION 'P6C source lock identity failed: %', v_source_lock;
    END IF;

    v_stage := 'copy';

    SELECT public.technical_configuration_baseline_copy(
      v_source_version_id,
      v_source_lock_revision
    )
    INTO v_copy_response;

    v_copy_version_id := (v_copy_response#>>'{data,id}')::UUID;
    v_copy_dossier_id := (v_copy_response#>>'{data,dossier_id}')::UUID;
    v_copy_revision := (v_copy_response#>>'{data,revision}')::BIGINT;
    v_copy_snapshot_before_lock := v_copy_response->'data';

    IF v_copy_version_id IS NULL
       OR v_copy_dossier_id IS DISTINCT FROM v_source_dossier_id
       OR v_copy_response#>>'{data,status}' IS DISTINCT FROM 'draft'
       OR NOT EXISTS (
         SELECT 1
         FROM public.technical_configuration_baseline_versions version_row
         WHERE version_row.id = v_copy_version_id
           AND version_row.source_baseline_version_id = v_source_version_id
       )
       OR (
         SELECT count(*)
         FROM public.technical_configuration_baseline_groups group_row
         WHERE group_row.baseline_version_id = v_copy_version_id
       ) IS DISTINCT FROM v_expected_group_count
       OR (
         SELECT count(*)
         FROM public.technical_configuration_baseline_subgroups subgroup_row
         WHERE subgroup_row.baseline_version_id = v_copy_version_id
       ) IS DISTINCT FROM 1::BIGINT
       OR (
         SELECT count(*)
         FROM public.technical_configuration_baseline_criteria criterion_row
         WHERE criterion_row.baseline_version_id = v_copy_version_id
       ) IS DISTINCT FROM 1::BIGINT
       OR (
         SELECT count(*)
         FROM public.technical_configuration_baseline_criteria criterion_row
         WHERE criterion_row.baseline_version_id = v_copy_version_id
           AND criterion_row.source_criterion_id = v_source_criterion_id
       ) IS DISTINCT FROM 1::BIGINT THEN
      RAISE EXCEPTION 'P6C baseline copy contract failed: %', v_copy_response;
    END IF;

    v_stage := 'lock';

    SELECT public.technical_configuration_baseline_lock(
      v_copy_version_id,
      v_copy_revision
    )
    INTO v_lock;

    v_lock_snapshot := v_lock->'data';

    v_stage := 'lock_contract';

    IF v_lock_snapshot->>'status' IS DISTINCT FROM 'locked'
       OR v_lock_snapshot->'groups' IS DISTINCT FROM
          v_copy_snapshot_before_lock->'groups' THEN
      RAISE EXCEPTION 'P6C baseline lock identity failed: %', v_lock;
    END IF;

    v_smoke_completed := true;
    v_stage := 'rollback_sentinel';

    RAISE EXCEPTION USING
      ERRCODE = 'P6C01',
      MESSAGE = 'P6C_ROLLBACK_SENTINEL';
  EXCEPTION
    WHEN SQLSTATE 'P6C01' THEN
      IF SQLERRM IS DISTINCT FROM 'P6C_ROLLBACK_SENTINEL' THEN
        v_failure_state := SQLSTATE;
        v_failure_message := SQLERRM;
        v_failure_stage := v_stage;
        GET STACKED DIAGNOSTICS
          v_failure_detail = PG_EXCEPTION_DETAIL,
          v_failure_context = PG_EXCEPTION_CONTEXT;
      END IF;
    WHEN OTHERS THEN
      v_failure_state := SQLSTATE;
      v_failure_message := SQLERRM;
      v_failure_stage := v_stage;
      GET STACKED DIAGNOSTICS
        v_failure_detail = PG_EXCEPTION_DETAIL,
        v_failure_context = PG_EXCEPTION_CONTEXT;
  END;

  -- P6C_POST_ROLLBACK_SOURCE_RESTORATION_CHECK
  IF v_source_snapshot_before IS NOT NULL
     AND public._technical_configuration_baseline_snapshot(v_source_version_id)
         IS DISTINCT FROM v_source_snapshot_before THEN
    RAISE EXCEPTION 'P6C rollback did not restore source %', v_source_version_id;
  END IF;

  -- P6C_POST_ROLLBACK_FIXTURE_CHECK
  IF v_copy_version_id IS NOT NULL
     AND (
       EXISTS (
         SELECT 1
         FROM public.technical_configuration_baseline_versions version_row
         WHERE version_row.id = v_copy_version_id
       )
       OR EXISTS (
         SELECT 1
         FROM public.technical_configuration_baseline_groups group_row
         WHERE group_row.baseline_version_id = v_copy_version_id
       )
       OR EXISTS (
         SELECT 1
         FROM public.technical_configuration_baseline_subgroups subgroup_row
         WHERE subgroup_row.baseline_version_id = v_copy_version_id
       )
       OR EXISTS (
         SELECT 1
         FROM public.technical_configuration_baseline_criteria criterion_row
         WHERE criterion_row.baseline_version_id = v_copy_version_id
       )
       OR EXISTS (
         SELECT 1
         FROM public.technical_configuration_baseline_documents document_row
         WHERE document_row.baseline_version_id = v_copy_version_id
       )
       OR EXISTS (
         SELECT 1
         FROM public.technical_configuration_baseline_citations citation_row
         WHERE citation_row.baseline_version_id = v_copy_version_id
       )
     ) THEN
    RAISE EXCEPTION 'P6C rollback residue detected for copy %', v_copy_version_id;
  END IF;

  IF v_failure_message IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = v_failure_state,
      MESSAGE = format(
        'P6C live acceptance failed [%s] at %s: %s (detail: %s; context: %s)',
        v_failure_state,
        COALESCE(NULLIF(v_failure_stage, ''), '<unknown>'),
        v_failure_message,
        COALESCE(NULLIF(v_failure_detail, ''), '<none>'),
        COALESCE(NULLIF(v_failure_context, ''), '<none>')
      );
  END IF;

  IF NOT v_smoke_completed THEN
    RAISE EXCEPTION 'P6C live acceptance did not reach the rollback sentinel';
  END IF;
END;
$p6c$;

SELECT jsonb_build_object(
  'status', 'passed',
  'rolled_back', true,
  'residue_check', 'fixture_scoped',
  'checked_at_utc', timezone('utc', clock_timestamp())
) AS p6c_live_acceptance;
