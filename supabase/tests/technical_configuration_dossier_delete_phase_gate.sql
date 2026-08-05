-- supabase/tests/technical_configuration_dossier_delete_phase_gate.sql
-- Purpose: prove P15A delete authorization, locked-history, cascade, and list contracts.
-- Non-destructive: all fixture writes are wrapped in a transaction and rolled back.
BEGIN;

CREATE FUNCTION pg_temp.expect_error(
  p_label TEXT, p_statement TEXT, p_expected_state TEXT, p_expected_message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $gate$
DECLARE
  v_state TEXT;
  v_message TEXT;
BEGIN
  BEGIN
    EXECUTE p_statement;
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS
        v_state = RETURNED_SQLSTATE,
        v_message = MESSAGE_TEXT;
      IF v_state = p_expected_state AND v_message = p_expected_message THEN
        RETURN;
      END IF;
      RAISE EXCEPTION '%: expected %/%, got %/%',
        p_label, p_expected_state, p_expected_message, v_state, v_message;
  END;
  RAISE EXCEPTION '%: expected statement to fail', p_label;
END;
$gate$;

CREATE FUNCTION pg_temp.set_claims(p_app_role TEXT, p_user_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
AS $gate$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', p_app_role,
      'role', 'authenticated',
      'user_id', p_user_id::TEXT,
      'sub', p_user_id::TEXT
    )::TEXT,
    true
  );
END;
$gate$;

CREATE FUNCTION pg_temp.expect_list_can_delete(
  p_list JSONB, p_dossier_id UUID, p_expected BOOLEAN, p_label TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $gate$
DECLARE
  v_actual BOOLEAN;
BEGIN
  SELECT (item->>'can_delete')::BOOLEAN INTO v_actual
  FROM jsonb_array_elements(p_list->'data') item
  WHERE item->>'id' = p_dossier_id::TEXT;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'list presence failed: % missing', p_label;
  END IF;
  IF v_actual IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION 'can_delete failed for %: expected %, got %',
      p_label, p_expected, v_actual;
  END IF;
END;
$gate$;

CREATE FUNCTION pg_temp.seed_draft_aggregate(p_suffix TEXT, p_user_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
AS $gate$
DECLARE
  v_dossier UUID;
  v_version UUID;
  v_group UUID;
  v_criterion UUID;
  v_baseline_document UUID;
  v_baseline_citation UUID;
  v_reference_product UUID;
  v_reference_response UUID;
  v_reference_document UUID;
  v_reference_citation UUID;
  v_supplier UUID;
  v_option UUID;
  v_comparison_set UUID;
  v_option_response UUID;
  v_option_document UUID;
  v_option_citation UUID;
  v_assessment UUID;
BEGIN
  INSERT INTO public.technical_configuration_dossiers (
    device_type_name, name, description, created_by, updated_by
  ) VALUES (
    'P15A draft device ' || p_suffix,
    'P15A draft aggregate ' || p_suffix,
    'Draft-only aggregate for cascade verification',
    p_user_id,
    p_user_id
  ) RETURNING id INTO v_dossier;

  INSERT INTO public.technical_configuration_baseline_versions (
    dossier_id, version_number, status, next_criterion_number, created_by, updated_by
  ) VALUES (v_dossier, 1, 'draft', 2, p_user_id, p_user_id)
  RETURNING id INTO v_version;

  INSERT INTO public.technical_configuration_baseline_groups (
    baseline_version_id, name, sort_order, created_by, updated_by
  ) VALUES (v_version, 'P15A draft group', 1, p_user_id, p_user_id)
  RETURNING id INTO v_group;

  INSERT INTO public.technical_configuration_baseline_criteria (
    baseline_version_id, group_id, criterion_code, title, requirement_text,
    sort_order, created_by, updated_by
  ) VALUES (
    v_version, v_group, 'TC-0001', 'P15A criterion',
    'P15A cascade requirement', 1, p_user_id, p_user_id
  ) RETURNING id INTO v_criterion;

  INSERT INTO public.technical_configuration_baseline_documents (
    baseline_version_id, name, url, created_by, updated_by
  ) VALUES (
    v_version, 'P15A baseline document',
    'https://example.com/p15a-baseline.pdf', p_user_id, p_user_id
  ) RETURNING id INTO v_baseline_document;

  INSERT INTO public.technical_configuration_baseline_citations (
    baseline_version_id, baseline_document_id, criterion_id, page_section,
    excerpt, created_by, updated_by
  ) VALUES (
    v_version, v_baseline_document, v_criterion, '1',
    'P15A baseline citation', p_user_id, p_user_id
  ) RETURNING id INTO v_baseline_citation;

  INSERT INTO public.technical_configuration_reference_products (
    baseline_version_id, model, manufacturer, description, created_by, updated_by
  ) VALUES (
    v_version, 'P15A reference model', 'P15A manufacturer',
    'P15A reference product', p_user_id, p_user_id
  ) RETURNING id INTO v_reference_product;

  INSERT INTO public.technical_configuration_reference_responses (
    baseline_version_id, reference_product_id, criterion_id, response_text,
    created_by, updated_by
  ) VALUES (
    v_version, v_reference_product, v_criterion,
    'P15A reference response', p_user_id, p_user_id
  ) RETURNING id INTO v_reference_response;

  INSERT INTO public.technical_configuration_reference_documents (
    baseline_version_id, reference_product_id, name, url, created_by, updated_by
  ) VALUES (
    v_version, v_reference_product, 'P15A reference document',
    'https://example.com/p15a-reference.pdf', p_user_id, p_user_id
  ) RETURNING id INTO v_reference_document;

  INSERT INTO public.technical_configuration_reference_citations (
    baseline_version_id, reference_document_id, criterion_id, page_section,
    excerpt, created_by, updated_by
  ) VALUES (
    v_version, v_reference_document, v_criterion, '2',
    'P15A reference citation', p_user_id, p_user_id
  ) RETURNING id INTO v_reference_citation;

  INSERT INTO public.technical_configuration_suppliers (
    dossier_id, name, created_by, updated_by
  ) VALUES (
    v_dossier, 'P15A Supplier ' || p_suffix, p_user_id, p_user_id
  ) RETURNING id INTO v_supplier;

  INSERT INTO public.technical_configuration_options (
    dossier_id, supplier_id, model, manufacturer, option_name, created_by, updated_by
  ) VALUES (
    v_dossier, v_supplier, 'P15A option model', 'P15A option manufacturer',
    'P15A option', p_user_id, p_user_id
  ) RETURNING id INTO v_option;

  INSERT INTO public.technical_configuration_comparison_sets (
    dossier_id, option_id, baseline_version_id, created_by, updated_by
  ) VALUES (v_dossier, v_option, v_version, p_user_id, p_user_id)
  RETURNING id INTO v_comparison_set;

  INSERT INTO public.technical_configuration_option_responses (
    comparison_set_id, baseline_version_id, criterion_id, response_text,
    supplementary_information, created_by, updated_by
  ) VALUES (
    v_comparison_set, v_version, v_criterion, 'P15A option response',
    'P15A supplementary information', p_user_id, p_user_id
  ) RETURNING id INTO v_option_response;

  INSERT INTO public.technical_configuration_option_documents (
    option_id, name, url, created_by, updated_by
  ) VALUES (
    v_option, 'P15A option document',
    'https://example.com/p15a-option.pdf', p_user_id, p_user_id
  ) RETURNING id INTO v_option_document;

  INSERT INTO public.technical_configuration_option_citations (
    option_id, baseline_version_id, comparison_set_id, option_document_id,
    criterion_id, page_section, excerpt, created_by, updated_by
  ) VALUES (
    v_option, v_version, v_comparison_set, v_option_document, v_criterion,
    '3', 'P15A option citation', p_user_id, p_user_id
  ) RETURNING id INTO v_option_citation;

  INSERT INTO public.technical_configuration_manual_assessments (
    comparison_set_id, baseline_version_id, criterion_id, technical_axis,
    evidence_axis, notes, created_by, updated_by
  ) VALUES (
    v_comparison_set, v_version, v_criterion, 'meets', 'complete',
    'P15A manual assessment', p_user_id, p_user_id
  ) RETURNING id INTO v_assessment;

  RETURN jsonb_build_object(
    'technical_configuration_dossiers', v_dossier,
    'technical_configuration_baseline_versions', v_version,
    'technical_configuration_baseline_groups', v_group,
    'technical_configuration_baseline_criteria', v_criterion,
    'technical_configuration_baseline_documents', v_baseline_document,
    'technical_configuration_baseline_citations', v_baseline_citation,
    'technical_configuration_reference_products', v_reference_product,
    'technical_configuration_reference_responses', v_reference_response,
    'technical_configuration_reference_documents', v_reference_document,
    'technical_configuration_reference_citations', v_reference_citation,
    'technical_configuration_suppliers', v_supplier,
    'technical_configuration_options', v_option,
    'technical_configuration_comparison_sets', v_comparison_set,
    'technical_configuration_option_responses', v_option_response,
    'technical_configuration_option_documents', v_option_document,
    'technical_configuration_option_citations', v_option_citation,
    'technical_configuration_manual_assessments', v_assessment
  );
END;
$gate$;

DO $gate$
DECLARE
  v_suffix TEXT := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_user_id BIGINT;
  v_fixture JSONB;
  v_draft_dossier UUID;
  v_admin_dossier UUID;
  v_locked_dossier UUID;
  v_archived_dossier UUID;
  v_missing_dossier UUID := gen_random_uuid();
  v_locked_version UUID;
  v_later_draft UUID;
  v_locked_group UUID;
  v_locked_criterion UUID;
  v_response JSONB;
  v_list JSONB;
  v_list_definition TEXT;
  v_plan JSONB;
  v_count BIGINT;
  v_check RECORD;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('technical_configuration_dossier_delete_phase_gate')
  );
  SELECT nv.id INTO v_user_id
  FROM public.nhan_vien nv
  WHERE nv.is_active = true
  ORDER BY nv.id
  LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Setup failed: no active nhan_vien row found';
  END IF;

  v_fixture := pg_temp.seed_draft_aggregate(v_suffix, v_user_id);
  v_draft_dossier := (v_fixture->>'technical_configuration_dossiers')::UUID;

  INSERT INTO public.technical_configuration_dossiers (
    device_type_name, name, description, created_by, updated_by
  ) VALUES (
    'P15A admin device ' || v_suffix, 'P15A raw admin delete ' || v_suffix,
    'Never-locked aggregate for raw admin semantics', v_user_id, v_user_id
  ) RETURNING id INTO v_admin_dossier;

  INSERT INTO public.technical_configuration_dossiers (
    device_type_name, name, description, created_by, updated_by
  ) VALUES (
    'P15A locked device ' || v_suffix, 'P15A locked history ' || v_suffix,
    'Locked baseline followed by a later draft', v_user_id, v_user_id
  ) RETURNING id INTO v_locked_dossier;

  INSERT INTO public.technical_configuration_dossiers (
    device_type_name, name, description, archived_at, archived_by,
    created_by, updated_by
  ) VALUES (
    'P15A archived device ' || v_suffix, 'P15A archived dossier ' || v_suffix,
    'Archived dossier must remain undeletable', now(), v_user_id,
    v_user_id, v_user_id
  ) RETURNING id INTO v_archived_dossier;

  INSERT INTO public.technical_configuration_baseline_versions (
    dossier_id, version_number, status, next_criterion_number, revision,
    locked_at, locked_by, created_by, updated_by
  ) VALUES (
    v_locked_dossier, 1, 'locked', 2, 2, now(), v_user_id, v_user_id, v_user_id
  ) RETURNING id INTO v_locked_version;

  INSERT INTO public.technical_configuration_baseline_groups (
    baseline_version_id, name, sort_order, created_by, updated_by
  ) VALUES (v_locked_version, 'P15A locked group', 1, v_user_id, v_user_id)
  RETURNING id INTO v_locked_group;
  INSERT INTO public.technical_configuration_baseline_criteria (
    baseline_version_id, group_id, criterion_code, requirement_text,
    sort_order, created_by, updated_by
  ) VALUES (
    v_locked_version, v_locked_group, 'TC-0001', 'P15A locked requirement',
    1, v_user_id, v_user_id
  ) RETURNING id INTO v_locked_criterion;
  INSERT INTO public.technical_configuration_baseline_versions (
    dossier_id, version_number, status, source_baseline_version_id,
    next_criterion_number, created_by, updated_by
  ) VALUES (
    v_locked_dossier, 2, 'draft', v_locked_version, 2, v_user_id, v_user_id
  ) RETURNING id INTO v_later_draft;

  PERFORM pg_temp.set_claims('global', v_user_id);
  SELECT pg_get_functiondef(
    'public.technical_configuration_dossiers_list(integer,integer,boolean)'::regprocedure
  ) INTO v_list_definition;
  IF position('WITH dossier_page AS MATERIALIZED' IN v_list_definition) = 0
     OR position('locked_dossiers AS' IN v_list_definition) = 0
     OR position('JOIN dossier_page page' IN v_list_definition) = 0
     OR position('ON page.id = v.dossier_id' IN v_list_definition) = 0
     OR position('LEFT JOIN locked_dossiers locked' IN v_list_definition) = 0 THEN
    RAISE EXCEPTION 'list definition failed: missing set-based locked dossier join';
  END IF;
  v_list := public.technical_configuration_dossiers_list(1, 100, true);
  PERFORM pg_temp.expect_list_can_delete(v_list, v_draft_dossier, true, 'draft dossier');
  PERFORM pg_temp.expect_list_can_delete(v_list, v_locked_dossier, false, 'locked dossier');
  PERFORM pg_temp.expect_list_can_delete(v_list, v_archived_dossier, false, 'archived dossier');

  PERFORM pg_temp.set_claims('qltb_khoa', v_user_id);
  PERFORM pg_temp.expect_error(
    'denied role',
    format('SELECT public.technical_configuration_dossiers_delete(%L::uuid, 1)', v_draft_dossier),
    '42501', 'permission_denied'
  );
  PERFORM set_config('request.jwt.claims', '{}'::JSONB::TEXT, true);
  PERFORM pg_temp.expect_error(
    'missing claims',
    format('SELECT public.technical_configuration_dossiers_delete(%L::uuid, 1)', v_draft_dossier),
    '42501', 'permission_denied'
  );

  PERFORM pg_temp.set_claims('global', v_user_id);
  PERFORM pg_temp.expect_error(
    'stale revision',
    format('SELECT public.technical_configuration_dossiers_delete(%L::uuid, 2)', v_draft_dossier),
    'PT409', 'stale_revision'
  );
  PERFORM pg_temp.expect_error(
    'archived dossier',
    format('SELECT public.technical_configuration_dossiers_delete(%L::uuid, 1)', v_archived_dossier),
    'PT409', 'archived_dossier'
  );
  PERFORM pg_temp.expect_error(
    'missing dossier',
    format('SELECT public.technical_configuration_dossiers_delete(%L::uuid, 1)', v_missing_dossier),
    'PT404', 'not_found'
  );
  PERFORM pg_temp.expect_error(
    'locked dossier',
    format('SELECT public.technical_configuration_dossiers_delete(%L::uuid, 1)', v_locked_dossier),
    'PT409', 'locked_dossier'
  );

  SELECT count(*) INTO v_count
  FROM public.technical_configuration_baseline_versions
  WHERE dossier_id = v_locked_dossier;
  IF v_count <> 2 OR NOT EXISTS (
    SELECT 1 FROM public.technical_configuration_baseline_groups WHERE id = v_locked_group
  ) OR NOT EXISTS (
    SELECT 1 FROM public.technical_configuration_baseline_criteria WHERE id = v_locked_criterion
  ) THEN
    RAISE EXCEPTION 'locked rejection failed: aggregate changed';
  END IF;

  v_response := public.technical_configuration_dossiers_delete(v_draft_dossier, 1);
  IF v_response <> jsonb_build_object('data', jsonb_build_object('id', v_draft_dossier)) THEN
    RAISE EXCEPTION 'global delete failed: unexpected response %', v_response;
  END IF;
  FOR v_check IN SELECT key AS table_name, value::UUID AS row_id
    FROM jsonb_each_text(v_fixture)
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE id = $1', v_check.table_name)
      INTO v_count USING v_check.row_id;
    IF v_count <> 0 THEN
      RAISE EXCEPTION 'cascade failed: % still contains %',
        v_check.table_name, v_check.row_id;
    END IF;
  END LOOP;

  v_list := public.technical_configuration_dossiers_list(1, 100, true);
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_list->'data') item
    WHERE item->>'id' = v_draft_dossier::TEXT
  ) THEN
    RAISE EXCEPTION 'list disappearance failed';
  END IF;
  PERFORM pg_temp.expect_error(
    'get disappearance',
    format('SELECT public.technical_configuration_dossiers_get(%L::uuid)', v_draft_dossier),
    'PT404', 'not_found'
  );

  PERFORM pg_temp.set_claims('admin', v_user_id);
  v_response := public.technical_configuration_dossiers_delete(v_admin_dossier, 1);
  IF v_response <> jsonb_build_object('data', jsonb_build_object('id', v_admin_dossier)) THEN
    RAISE EXCEPTION 'raw admin delete failed: unexpected response %', v_response;
  END IF;

  EXECUTE $plan$
    EXPLAIN (FORMAT JSON)
    WITH dossier_page AS MATERIALIZED (
      SELECT d.id, d.archived_at, d.updated_at
      FROM public.technical_configuration_dossiers d
      ORDER BY d.updated_at DESC, d.id
      LIMIT 100
    ), locked_dossiers AS (
      SELECT DISTINCT v.dossier_id
      FROM public.technical_configuration_baseline_versions v
      JOIN dossier_page page ON page.id = v.dossier_id
      WHERE v.status = 'locked'
    )
    SELECT page.id,
      page.archived_at IS NULL AND locked.dossier_id IS NULL AS can_delete
    FROM dossier_page page
    LEFT JOIN locked_dossiers locked ON locked.dossier_id = page.id
    ORDER BY page.updated_at DESC, page.id
  $plan$ INTO v_plan;
  IF jsonb_path_exists(
    v_plan, '$.**."Parent Relationship" ? (@ == "SubPlan")'
  ) OR NOT jsonb_path_exists(
    v_plan, '$.**."CTE Name" ? (@ == "dossier_page")'
  ) THEN
    RAISE EXCEPTION 'set-based can_delete plan expected a page CTE without a subplan';
  END IF;
END;
$gate$;

ROLLBACK;
