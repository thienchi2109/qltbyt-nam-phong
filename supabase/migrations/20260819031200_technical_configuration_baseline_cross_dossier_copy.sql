-- Add dormant, bounded cross-dossier baseline copy contracts for Phase 1.
BEGIN;
CREATE SCHEMA IF NOT EXISTS technical_configuration_internal;
REVOKE ALL ON SCHEMA technical_configuration_internal FROM PUBLIC;

-- Supersedes the same-dossier lineage invariant from:
-- 20260714010000_technical_configuration_baseline_locking.sql
-- Keeps the existing technical_configuration_baseline_copy RPC unchanged.
ALTER TABLE public.technical_configuration_baseline_versions
  DROP CONSTRAINT technical_configuration_baseline_versions_source_fkey;
ALTER TABLE public.technical_configuration_baseline_versions
  ADD CONSTRAINT technical_configuration_baseline_versions_source_fkey
  FOREIGN KEY (source_baseline_version_id)
  REFERENCES public.technical_configuration_baseline_versions (id)
  ON DELETE RESTRICT;
CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_validate_source_lineage()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_source_status TEXT;
BEGIN
  IF NEW.source_baseline_version_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT v.status INTO v_source_status
  FROM public.technical_configuration_baseline_versions v
  WHERE v.id = NEW.source_baseline_version_id;
  IF v_source_status IS DISTINCT FROM 'locked' THEN
    RAISE EXCEPTION 'source_not_locked' USING ERRCODE = 'PT409';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS technical_configuration_baseline_validate_source_lineage
  ON public.technical_configuration_baseline_versions;
CREATE TRIGGER technical_configuration_baseline_validate_source_lineage
BEFORE INSERT OR UPDATE OF source_baseline_version_id
ON public.technical_configuration_baseline_versions
FOR EACH ROW
EXECUTE FUNCTION public.technical_configuration_baseline_validate_source_lineage();
CREATE OR REPLACE FUNCTION technical_configuration_internal.baseline_cross_dossier_preview(
  p_source_baseline_version_id UUID,
  p_target_dossier_id UUID,
  p_expected_dossier_revision BIGINT,
  p_expected_target_baseline_version_id UUID,
  p_expected_target_baseline_revision BIGINT
)
RETURNS JSONB LANGUAGE plpgsql
SET search_path = public, pg_temp
SET timezone = 'UTC'
AS $$
DECLARE
  v_role TEXT;
  v_claim_user_id TEXT;
  v_source public.technical_configuration_baseline_versions%ROWTYPE;
  v_source_dossier public.technical_configuration_dossiers%ROWTYPE;
  v_target public.technical_configuration_dossiers%ROWTYPE;
  v_draft public.technical_configuration_baseline_versions%ROWTYPE;
  v_mode TEXT;
  v_copy JSONB;
  v_delete JSONB;
  v_preserved JSONB;
  v_canonical JSONB;
  v_fingerprint TEXT;
BEGIN
  v_role := NULLIF(current_setting('request.jwt.claims', true)::JSONB->>'app_role', '');
  v_claim_user_id := NULLIF(current_setting('request.jwt.claims', true)::JSONB->>'user_id', '');
  IF v_role IS NULL OR v_role = '' THEN RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501'; END IF;
  IF v_claim_user_id IS NULL THEN RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501'; END IF;
  PERFORM public._technical_configuration_require_global_user();
  IF p_source_baseline_version_id IS NULL OR p_target_dossier_id IS NULL
     OR p_expected_dossier_revision IS NULL
     OR ((p_expected_target_baseline_version_id IS NULL)
         <> (p_expected_target_baseline_revision IS NULL)) THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;
  SELECT * INTO v_source
  FROM public.technical_configuration_baseline_versions v
  WHERE v.id = p_source_baseline_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;
  IF v_source.status <> 'locked' THEN
    RAISE EXCEPTION 'source_not_locked' USING ERRCODE = 'PT409';
  END IF;
  IF v_source.dossier_id = p_target_dossier_id THEN
    RAISE EXCEPTION 'source_matches_target_dossier' USING ERRCODE = 'PT422';
  END IF;
  SELECT * INTO v_source_dossier
  FROM public.technical_configuration_dossiers d
  WHERE d.id = v_source.dossier_id;
  SELECT * INTO v_target
  FROM public.technical_configuration_dossiers d
  WHERE d.id = p_target_dossier_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;
  IF v_target.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'dossier_archived' USING ERRCODE = 'PT409';
  END IF;
  IF v_target.revision IS DISTINCT FROM p_expected_dossier_revision THEN
    RAISE EXCEPTION 'stale_revision' USING ERRCODE = 'PT409';
  END IF;
  SELECT * INTO v_draft
  FROM public.technical_configuration_baseline_versions v
  WHERE v.dossier_id = p_target_dossier_id AND v.status = 'draft';
  IF p_expected_target_baseline_version_id IS NULL THEN
    IF v_draft.id IS NOT NULL THEN
      RAISE EXCEPTION 'target_draft_changed' USING ERRCODE = 'PT409';
    END IF;
    v_mode := 'create';
  ELSE
    IF v_draft.id IS DISTINCT FROM p_expected_target_baseline_version_id THEN
      RAISE EXCEPTION 'target_draft_changed' USING ERRCODE = 'PT409';
    END IF;
    IF v_draft.revision IS DISTINCT FROM p_expected_target_baseline_revision THEN
      RAISE EXCEPTION 'stale_revision' USING ERRCODE = 'PT409';
    END IF;
    v_mode := 'replace';
  END IF;
  SELECT jsonb_build_object(
    'main_sections', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.technical_configuration_baseline_groups x WHERE x.baseline_version_id = v_source.id), '[]'::JSONB),
    'subgroups', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.technical_configuration_baseline_subgroups x WHERE x.baseline_version_id = v_source.id), '[]'::JSONB),
    'criteria', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.technical_configuration_baseline_criteria x WHERE x.baseline_version_id = v_source.id), '[]'::JSONB),
    'reference_products', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.technical_configuration_reference_products x WHERE x.baseline_version_id = v_source.id), '[]'::JSONB),
    'reference_responses', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.technical_configuration_reference_responses x WHERE x.baseline_version_id = v_source.id), '[]'::JSONB),
    'baseline_documents', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.technical_configuration_baseline_documents x WHERE x.baseline_version_id = v_source.id), '[]'::JSONB),
    'baseline_citations', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.technical_configuration_baseline_citations x WHERE x.baseline_version_id = v_source.id), '[]'::JSONB),
    'reference_documents', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.technical_configuration_reference_documents x WHERE x.baseline_version_id = v_source.id), '[]'::JSONB),
    'reference_citations', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.technical_configuration_reference_citations x WHERE x.baseline_version_id = v_source.id), '[]'::JSONB)
  ) INTO v_copy;
  SELECT jsonb_build_object(
    'main_sections', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.technical_configuration_baseline_groups x WHERE x.baseline_version_id = v_draft.id), '[]'::JSONB),
    'subgroups', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.technical_configuration_baseline_subgroups x WHERE x.baseline_version_id = v_draft.id), '[]'::JSONB),
    'criteria', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.technical_configuration_baseline_criteria x WHERE x.baseline_version_id = v_draft.id), '[]'::JSONB),
    'reference_products', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.technical_configuration_reference_products x WHERE x.baseline_version_id = v_draft.id), '[]'::JSONB),
    'reference_responses', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.technical_configuration_reference_responses x WHERE x.baseline_version_id = v_draft.id), '[]'::JSONB),
    'baseline_documents', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.technical_configuration_baseline_documents x WHERE x.baseline_version_id = v_draft.id), '[]'::JSONB),
    'baseline_citations', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.technical_configuration_baseline_citations x WHERE x.baseline_version_id = v_draft.id), '[]'::JSONB),
    'reference_documents', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.technical_configuration_reference_documents x WHERE x.baseline_version_id = v_draft.id), '[]'::JSONB),
    'reference_citations', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.technical_configuration_reference_citations x WHERE x.baseline_version_id = v_draft.id), '[]'::JSONB),
    'option_responses', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.technical_configuration_option_responses x WHERE x.baseline_version_id = v_draft.id), '[]'::JSONB),
    'option_citations', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.technical_configuration_option_citations x WHERE x.baseline_version_id = v_draft.id), '[]'::JSONB),
    'manual_assessments', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.technical_configuration_manual_assessments x WHERE x.baseline_version_id = v_draft.id), '[]'::JSONB)
  ) INTO v_delete;
  SELECT jsonb_build_object(
    'suppliers', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.technical_configuration_suppliers x WHERE x.dossier_id = p_target_dossier_id), '[]'::JSONB),
    'options', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.technical_configuration_options x WHERE x.dossier_id = p_target_dossier_id), '[]'::JSONB),
    'option_documents', COALESCE((SELECT jsonb_agg(to_jsonb(doc) ORDER BY doc.id) FROM public.technical_configuration_option_documents doc JOIN public.technical_configuration_options opt ON opt.id = doc.option_id WHERE opt.dossier_id = p_target_dossier_id), '[]'::JSONB),
    'comparison_sets', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.technical_configuration_comparison_sets x WHERE x.dossier_id = p_target_dossier_id AND x.baseline_version_id = v_draft.id), '[]'::JSONB)
  ) INTO v_preserved;
  v_canonical := jsonb_build_object(
    'version', 'cross-dossier-baseline-copy-v1',
    'source', jsonb_build_object(
      'baseline_version_id', v_source.id,
      'baseline_revision', v_source.revision,
      'dossier_id', v_source.dossier_id
    ),
    'target', jsonb_build_object(
      'dossier_id', v_target.id,
      'dossier_revision', v_target.revision,
      'baseline_version_id', v_draft.id,
      'baseline_revision', v_draft.revision
    ),
    'copied', v_copy, 'deleted', v_delete, 'preserved', v_preserved
  );
  v_fingerprint := encode(extensions.digest(convert_to(v_canonical::TEXT, 'UTF8'), 'sha256'), 'hex');
  RETURN jsonb_build_object('data', jsonb_build_object(
    'mode', v_mode,
    'requires_replacement_confirmation', v_mode = 'replace',
    'preview_fingerprint', v_fingerprint,
    'source', jsonb_build_object(
      'baseline_version_id', v_source.id, 'dossier_id', v_source.dossier_id,
      'device_type_name', v_source_dossier.device_type_name, 'dossier_name', v_source_dossier.name,
      'dossier_archived_at', v_source_dossier.archived_at, 'version_number', v_source.version_number,
      'locked_at', v_source.locked_at
    ),
    'target', jsonb_build_object(
      'dossier_id', v_target.id, 'dossier_revision', v_target.revision,
      'baseline_version_id', v_draft.id, 'baseline_revision', v_draft.revision,
      'version_number', v_draft.version_number
    ),
    'copy_counts', jsonb_build_object(
      'main_sections', jsonb_array_length(v_copy->'main_sections'), 'subgroups', jsonb_array_length(v_copy->'subgroups'),
      'criteria', jsonb_array_length(v_copy->'criteria'), 'reference_products', jsonb_array_length(v_copy->'reference_products'),
      'reference_responses', jsonb_array_length(v_copy->'reference_responses'), 'baseline_documents', jsonb_array_length(v_copy->'baseline_documents'),
      'baseline_citations', jsonb_array_length(v_copy->'baseline_citations'), 'reference_documents', jsonb_array_length(v_copy->'reference_documents'),
      'reference_citations', jsonb_array_length(v_copy->'reference_citations')
    ),
    'delete_counts', jsonb_build_object(
      'main_sections', jsonb_array_length(v_delete->'main_sections'), 'subgroups', jsonb_array_length(v_delete->'subgroups'),
      'criteria', jsonb_array_length(v_delete->'criteria'), 'reference_products', jsonb_array_length(v_delete->'reference_products'),
      'reference_responses', jsonb_array_length(v_delete->'reference_responses'), 'baseline_documents', jsonb_array_length(v_delete->'baseline_documents'),
      'baseline_citations', jsonb_array_length(v_delete->'baseline_citations'), 'reference_documents', jsonb_array_length(v_delete->'reference_documents'),
      'reference_citations', jsonb_array_length(v_delete->'reference_citations'), 'option_responses', jsonb_array_length(v_delete->'option_responses'),
      'option_citations', jsonb_array_length(v_delete->'option_citations'), 'manual_assessments', jsonb_array_length(v_delete->'manual_assessments')
    ),
    'preserved_counts', jsonb_build_object(
      'suppliers', jsonb_array_length(v_preserved->'suppliers'), 'options', jsonb_array_length(v_preserved->'options'),
      'option_documents', jsonb_array_length(v_preserved->'option_documents'), 'comparison_sets', jsonb_array_length(v_preserved->'comparison_sets')
    )
  ));
END;
$$;
CREATE OR REPLACE FUNCTION technical_configuration_internal.baseline_cross_dossier_copy_rows(
  p_source_baseline_version_id UUID,
  p_target_baseline_version_id UUID,
  p_user_id BIGINT
)
RETURNS VOID LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_role TEXT;
  v_claim_user_id TEXT;
BEGIN
  v_role := NULLIF(current_setting('request.jwt.claims', true)::JSONB->>'app_role', '');
  v_claim_user_id := NULLIF(current_setting('request.jwt.claims', true)::JSONB->>'user_id', '');
  IF v_role IS NULL OR v_role = '' THEN RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501'; END IF;
  IF v_claim_user_id IS NULL THEN RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501'; END IF;
  PERFORM public._technical_configuration_require_global_user();
  CREATE TEMP TABLE technical_configuration_baseline_group_copy_map (source_id UUID PRIMARY KEY, target_id UUID NOT NULL UNIQUE) ON COMMIT DROP;
  CREATE TEMP TABLE technical_configuration_baseline_subgroup_copy_map (source_id UUID PRIMARY KEY, target_id UUID NOT NULL UNIQUE) ON COMMIT DROP;
  CREATE TEMP TABLE technical_configuration_baseline_criterion_copy_map (source_id UUID PRIMARY KEY, target_id UUID NOT NULL UNIQUE) ON COMMIT DROP;
  CREATE TEMP TABLE technical_configuration_reference_product_copy_map (source_id UUID PRIMARY KEY, target_id UUID NOT NULL UNIQUE) ON COMMIT DROP;
  CREATE TEMP TABLE technical_configuration_baseline_document_copy_map (source_id UUID PRIMARY KEY, target_id UUID NOT NULL UNIQUE) ON COMMIT DROP;
  CREATE TEMP TABLE technical_configuration_reference_document_copy_map (source_id UUID PRIMARY KEY, target_id UUID NOT NULL UNIQUE) ON COMMIT DROP;
  INSERT INTO pg_temp.technical_configuration_baseline_group_copy_map SELECT id, gen_random_uuid() FROM public.technical_configuration_baseline_groups WHERE baseline_version_id = p_source_baseline_version_id;
  INSERT INTO public.technical_configuration_baseline_groups (id, baseline_version_id, name, sort_order, created_by, updated_by)
  SELECT m.target_id, p_target_baseline_version_id, g.name, g.sort_order, p_user_id, p_user_id FROM pg_temp.technical_configuration_baseline_group_copy_map m JOIN public.technical_configuration_baseline_groups g ON g.id = m.source_id;
  INSERT INTO pg_temp.technical_configuration_baseline_subgroup_copy_map SELECT id, gen_random_uuid() FROM public.technical_configuration_baseline_subgroups WHERE baseline_version_id = p_source_baseline_version_id;
  INSERT INTO public.technical_configuration_baseline_subgroups (id, baseline_version_id, group_id, name, sort_order, created_by, updated_by)
  SELECT sm.target_id, p_target_baseline_version_id, gm.target_id, sg.name, sg.sort_order, p_user_id, p_user_id FROM pg_temp.technical_configuration_baseline_subgroup_copy_map sm JOIN public.technical_configuration_baseline_subgroups sg ON sg.id = sm.source_id JOIN pg_temp.technical_configuration_baseline_group_copy_map gm ON gm.source_id = sg.group_id;
  INSERT INTO pg_temp.technical_configuration_baseline_criterion_copy_map SELECT id, gen_random_uuid() FROM public.technical_configuration_baseline_criteria WHERE baseline_version_id = p_source_baseline_version_id;
  INSERT INTO public.technical_configuration_baseline_criteria (id, baseline_version_id, group_id, subgroup_id, criterion_code, title, requirement_text, sort_order, source_criterion_id, created_by, updated_by)
  SELECT cm.target_id, p_target_baseline_version_id, gm.target_id, sm.target_id, c.criterion_code, c.title, c.requirement_text, c.sort_order, c.id, p_user_id, p_user_id FROM pg_temp.technical_configuration_baseline_criterion_copy_map cm JOIN public.technical_configuration_baseline_criteria c ON c.id = cm.source_id JOIN pg_temp.technical_configuration_baseline_group_copy_map gm ON gm.source_id = c.group_id LEFT JOIN pg_temp.technical_configuration_baseline_subgroup_copy_map sm ON sm.source_id = c.subgroup_id;
  INSERT INTO pg_temp.technical_configuration_reference_product_copy_map SELECT id, gen_random_uuid() FROM public.technical_configuration_reference_products WHERE baseline_version_id = p_source_baseline_version_id;
  INSERT INTO public.technical_configuration_reference_products (id, baseline_version_id, model, manufacturer, description, notes, created_by, updated_by)
  SELECT pm.target_id, p_target_baseline_version_id, p.model, p.manufacturer, p.description, p.notes, p_user_id, p_user_id FROM pg_temp.technical_configuration_reference_product_copy_map pm JOIN public.technical_configuration_reference_products p ON p.id = pm.source_id;
  INSERT INTO public.technical_configuration_reference_responses (id, baseline_version_id, reference_product_id, criterion_id, response_text, created_by, updated_by)
  SELECT gen_random_uuid(), p_target_baseline_version_id, pm.target_id, cm.target_id, r.response_text, p_user_id, p_user_id FROM public.technical_configuration_reference_responses r JOIN pg_temp.technical_configuration_reference_product_copy_map pm ON pm.source_id = r.reference_product_id JOIN pg_temp.technical_configuration_baseline_criterion_copy_map cm ON cm.source_id = r.criterion_id WHERE r.baseline_version_id = p_source_baseline_version_id;
  INSERT INTO pg_temp.technical_configuration_baseline_document_copy_map SELECT id, gen_random_uuid() FROM public.technical_configuration_baseline_documents WHERE baseline_version_id = p_source_baseline_version_id;
  INSERT INTO public.technical_configuration_baseline_documents (id, baseline_version_id, name, url, created_by, updated_by)
  SELECT dm.target_id, p_target_baseline_version_id, d.name, d.url, p_user_id, p_user_id FROM pg_temp.technical_configuration_baseline_document_copy_map dm JOIN public.technical_configuration_baseline_documents d ON d.id = dm.source_id;
  INSERT INTO public.technical_configuration_baseline_citations (id, baseline_version_id, baseline_document_id, criterion_id, page_section, excerpt, created_by, updated_by)
  SELECT gen_random_uuid(), p_target_baseline_version_id, dm.target_id, cm.target_id, c.page_section, c.excerpt, p_user_id, p_user_id FROM public.technical_configuration_baseline_citations c JOIN pg_temp.technical_configuration_baseline_document_copy_map dm ON dm.source_id = c.baseline_document_id JOIN pg_temp.technical_configuration_baseline_criterion_copy_map cm ON cm.source_id = c.criterion_id WHERE c.baseline_version_id = p_source_baseline_version_id;
  INSERT INTO pg_temp.technical_configuration_reference_document_copy_map SELECT id, gen_random_uuid() FROM public.technical_configuration_reference_documents WHERE baseline_version_id = p_source_baseline_version_id;
  INSERT INTO public.technical_configuration_reference_documents (id, baseline_version_id, reference_product_id, name, url, created_by, updated_by)
  SELECT dm.target_id, p_target_baseline_version_id, pm.target_id, d.name, d.url, p_user_id, p_user_id FROM pg_temp.technical_configuration_reference_document_copy_map dm JOIN public.technical_configuration_reference_documents d ON d.id = dm.source_id JOIN pg_temp.technical_configuration_reference_product_copy_map pm ON pm.source_id = d.reference_product_id;
  INSERT INTO public.technical_configuration_reference_citations (id, baseline_version_id, reference_document_id, criterion_id, page_section, excerpt, created_by, updated_by)
  SELECT gen_random_uuid(), p_target_baseline_version_id, dm.target_id, cm.target_id, c.page_section, c.excerpt, p_user_id, p_user_id FROM public.technical_configuration_reference_citations c JOIN pg_temp.technical_configuration_reference_document_copy_map dm ON dm.source_id = c.reference_document_id JOIN pg_temp.technical_configuration_baseline_criterion_copy_map cm ON cm.source_id = c.criterion_id WHERE c.baseline_version_id = p_source_baseline_version_id;
  UPDATE public.technical_configuration_baseline_versions
  SET next_criterion_number = (
        SELECT source.next_criterion_number
        FROM public.technical_configuration_baseline_versions source
        WHERE source.id = p_source_baseline_version_id
      ),
      updated_at = now(), updated_by = p_user_id
  WHERE id = p_target_baseline_version_id;
END;
$$;
CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_cross_dossier_sources_list(
  p_target_dossier_id UUID,
  p_search TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 20
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_role TEXT;
  v_claim_user_id TEXT;
  v_search TEXT;
  v_archived_at TIMESTAMPTZ;
  v_data JSONB;
  v_total BIGINT;
BEGIN
  v_role := NULLIF(current_setting('request.jwt.claims', true)::JSONB->>'app_role', '');
  v_claim_user_id := NULLIF(current_setting('request.jwt.claims', true)::JSONB->>'user_id', '');
  IF v_role IS NULL OR v_role = '' THEN RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501'; END IF;
  IF v_claim_user_id IS NULL THEN RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501'; END IF;
  PERFORM public._technical_configuration_require_global_user();
  IF p_target_dossier_id IS NULL OR p_page IS NULL OR p_page < 1
     OR p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 100 THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;
  SELECT d.archived_at INTO v_archived_at FROM public.technical_configuration_dossiers d WHERE d.id = p_target_dossier_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404'; END IF;
  IF v_archived_at IS NOT NULL THEN RAISE EXCEPTION 'dossier_archived' USING ERRCODE = 'PT409'; END IF;
  v_search := public._sanitize_ilike_pattern(lower(btrim(p_search)));
  WITH group_counts AS (
    SELECT baseline_version_id, COUNT(*) AS count FROM public.technical_configuration_baseline_groups GROUP BY baseline_version_id
  ), subgroup_counts AS (
    SELECT baseline_version_id, COUNT(*) AS count FROM public.technical_configuration_baseline_subgroups GROUP BY baseline_version_id
  ), criterion_counts AS (
    SELECT baseline_version_id, COUNT(*) AS count FROM public.technical_configuration_baseline_criteria GROUP BY baseline_version_id
  ), eligible AS MATERIALIZED (
    SELECT v.id AS baseline_version_id, v.dossier_id, d.device_type_name, d.name AS dossier_name,
      d.archived_at AS dossier_archived_at, v.version_number, v.locked_at,
      COALESCE(gc.count, 0) AS main_section_count, COALESCE(sc.count, 0) AS subgroup_count,
      COALESCE(cc.count, 0) AS criterion_count
    FROM public.technical_configuration_baseline_versions v
    JOIN public.technical_configuration_dossiers d ON d.id = v.dossier_id
    LEFT JOIN group_counts gc ON gc.baseline_version_id = v.id
    LEFT JOIN subgroup_counts sc ON sc.baseline_version_id = v.id
    LEFT JOIN criterion_counts cc ON cc.baseline_version_id = v.id
    WHERE v.status = 'locked' AND v.dossier_id <> p_target_dossier_id
      AND (v_search IS NULL OR lower(d.device_type_name) ILIKE '%' || v_search || '%' ESCAPE '\'
        OR lower(d.name) ILIKE '%' || v_search || '%' ESCAPE '\')
  ), page_rows AS (
    SELECT e.* FROM eligible e
    ORDER BY e.locked_at DESC, e.dossier_name ASC, e.version_number DESC, e.baseline_version_id ASC
    LIMIT p_page_size OFFSET ((p_page - 1)::BIGINT * p_page_size)
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'baseline_version_id', p.baseline_version_id, 'dossier_id', p.dossier_id,
      'device_type_name', p.device_type_name, 'dossier_name', p.dossier_name,
      'dossier_archived_at', p.dossier_archived_at, 'version_number', p.version_number,
      'locked_at', p.locked_at, 'main_section_count', p.main_section_count,
      'subgroup_count', p.subgroup_count, 'criterion_count', p.criterion_count
    ) ORDER BY p.locked_at DESC, p.dossier_name ASC, p.version_number DESC, p.baseline_version_id ASC), '[]'::JSONB),
    (SELECT COUNT(*) FROM eligible)
  INTO v_data, v_total FROM page_rows p;
  RETURN jsonb_build_object('data', v_data, 'total', v_total, 'page', p_page, 'page_size', p_page_size);
END;
$$;
CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_cross_dossier_copy_preview(
  p_source_baseline_version_id UUID,
  p_target_dossier_id UUID,
  p_expected_dossier_revision BIGINT,
  p_expected_target_baseline_version_id UUID,
  p_expected_target_baseline_revision BIGINT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_role TEXT;
  v_claim_user_id TEXT;
BEGIN
  v_role := NULLIF(current_setting('request.jwt.claims', true)::JSONB->>'app_role', '');
  v_claim_user_id := NULLIF(current_setting('request.jwt.claims', true)::JSONB->>'user_id', '');
  IF v_role IS NULL OR v_role = '' THEN RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501'; END IF;
  IF v_claim_user_id IS NULL THEN RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501'; END IF;
  PERFORM public._technical_configuration_require_global_user();
  IF ((p_expected_target_baseline_version_id IS NULL)
      <> (p_expected_target_baseline_revision IS NULL)) THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;
  RETURN technical_configuration_internal.baseline_cross_dossier_preview(
    p_source_baseline_version_id, p_target_dossier_id, p_expected_dossier_revision,
    p_expected_target_baseline_version_id, p_expected_target_baseline_revision
  );
END;
$$;
CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_cross_dossier_copy_apply(
  p_source_baseline_version_id UUID,
  p_target_dossier_id UUID,
  p_expected_dossier_revision BIGINT,
  p_expected_target_baseline_version_id UUID,
  p_expected_target_baseline_revision BIGINT,
  p_preview_fingerprint TEXT,
  p_confirm_replace BOOLEAN
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_role TEXT;
  v_claim_user_id TEXT;
  v_user_id BIGINT;
  v_preview JSONB;
  v_data JSONB;
  v_mode TEXT;
  v_target_version_id UUID;
  v_target_revision BIGINT;
  v_dossier_revision BIGINT;
BEGIN
  v_role := NULLIF(current_setting('request.jwt.claims', true)::JSONB->>'app_role', '');
  v_claim_user_id := NULLIF(current_setting('request.jwt.claims', true)::JSONB->>'user_id', '');
  IF v_role IS NULL OR v_role = '' THEN RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501'; END IF;
  IF v_claim_user_id IS NULL THEN RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501'; END IF;
  v_user_id := public._technical_configuration_require_global_user();
  IF p_source_baseline_version_id IS NULL OR p_target_dossier_id IS NULL
     OR p_expected_dossier_revision IS NULL
     OR p_preview_fingerprint IS NULL OR p_preview_fingerprint !~ '^[0-9a-f]{64}$'
     OR p_confirm_replace IS NULL
     OR ((p_expected_target_baseline_version_id IS NULL)
         <> (p_expected_target_baseline_revision IS NULL)) THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;
  BEGIN
    PERFORM public._technical_configuration_require_editable_dossier(
      p_target_dossier_id, p_expected_dossier_revision
    );
  EXCEPTION WHEN SQLSTATE 'PT409' THEN
    IF SQLERRM = 'archived_dossier' THEN
      RAISE EXCEPTION 'dossier_archived' USING ERRCODE = 'PT409';
    END IF;
    RAISE;
  END;
  BEGIN
    LOCK TABLE public.technical_configuration_baseline_versions IN SHARE ROW EXCLUSIVE MODE NOWAIT;
    LOCK TABLE public.technical_configuration_baseline_groups IN SHARE ROW EXCLUSIVE MODE NOWAIT;
    LOCK TABLE public.technical_configuration_baseline_subgroups IN SHARE ROW EXCLUSIVE MODE NOWAIT;
    LOCK TABLE public.technical_configuration_baseline_criteria IN SHARE ROW EXCLUSIVE MODE NOWAIT;
    LOCK TABLE public.technical_configuration_reference_products IN SHARE ROW EXCLUSIVE MODE NOWAIT;
    LOCK TABLE public.technical_configuration_reference_responses IN SHARE ROW EXCLUSIVE MODE NOWAIT;
    LOCK TABLE public.technical_configuration_baseline_documents IN SHARE ROW EXCLUSIVE MODE NOWAIT;
    LOCK TABLE public.technical_configuration_baseline_citations IN SHARE ROW EXCLUSIVE MODE NOWAIT;
    LOCK TABLE public.technical_configuration_reference_documents IN SHARE ROW EXCLUSIVE MODE NOWAIT;
    LOCK TABLE public.technical_configuration_reference_citations IN SHARE ROW EXCLUSIVE MODE NOWAIT;
    LOCK TABLE public.technical_configuration_suppliers IN SHARE ROW EXCLUSIVE MODE NOWAIT;
    LOCK TABLE public.technical_configuration_options IN SHARE ROW EXCLUSIVE MODE NOWAIT;
    LOCK TABLE public.technical_configuration_option_documents IN SHARE ROW EXCLUSIVE MODE NOWAIT;
    LOCK TABLE public.technical_configuration_comparison_sets IN SHARE ROW EXCLUSIVE MODE NOWAIT;
    LOCK TABLE public.technical_configuration_option_responses IN SHARE ROW EXCLUSIVE MODE NOWAIT;
    LOCK TABLE public.technical_configuration_option_citations IN SHARE ROW EXCLUSIVE MODE NOWAIT;
    LOCK TABLE public.technical_configuration_manual_assessments IN SHARE ROW EXCLUSIVE MODE NOWAIT;
  EXCEPTION WHEN lock_not_available THEN
    RAISE EXCEPTION 'concurrent_write_retry' USING ERRCODE = 'PT409';
  END;
  v_preview := technical_configuration_internal.baseline_cross_dossier_preview(
    p_source_baseline_version_id, p_target_dossier_id, p_expected_dossier_revision,
    p_expected_target_baseline_version_id, p_expected_target_baseline_revision
  );
  v_data := v_preview->'data';
  IF v_data->>'preview_fingerprint' IS DISTINCT FROM p_preview_fingerprint THEN
    RAISE EXCEPTION 'stale_preview' USING ERRCODE = 'PT409';
  END IF;
  v_mode := v_data->>'mode';
  IF v_mode = 'replace' AND NOT p_confirm_replace THEN
    RAISE EXCEPTION 'replacement_confirmation_needed' USING ERRCODE = 'PT409';
  END IF;
  IF v_mode = 'create' THEN
    INSERT INTO public.technical_configuration_baseline_versions (
      dossier_id, version_number, status, next_criterion_number, revision,
      source_baseline_version_id, created_by, updated_by
    )
    SELECT p_target_dossier_id, COALESCE(MAX(v.version_number), 0) + 1, 'draft', 1, 1,
      p_source_baseline_version_id, v_user_id, v_user_id
    FROM public.technical_configuration_baseline_versions v
    WHERE v.dossier_id = p_target_dossier_id
    RETURNING id INTO v_target_version_id;
  ELSE
    v_target_version_id := p_expected_target_baseline_version_id;
    DELETE FROM public.technical_configuration_option_citations WHERE baseline_version_id = v_target_version_id;
    DELETE FROM public.technical_configuration_option_responses WHERE baseline_version_id = v_target_version_id;
    DELETE FROM public.technical_configuration_manual_assessments WHERE baseline_version_id = v_target_version_id;
    DELETE FROM public.technical_configuration_reference_products WHERE baseline_version_id = v_target_version_id;
    DELETE FROM public.technical_configuration_baseline_documents WHERE baseline_version_id = v_target_version_id;
    DELETE FROM public.technical_configuration_baseline_groups WHERE baseline_version_id = v_target_version_id;
    UPDATE public.technical_configuration_baseline_versions
    SET source_baseline_version_id = p_source_baseline_version_id, revision = revision + 1,
        updated_at = now(), updated_by = v_user_id
    WHERE id = v_target_version_id;
  END IF;
  PERFORM technical_configuration_internal.baseline_cross_dossier_copy_rows(
    p_source_baseline_version_id, v_target_version_id, v_user_id
  );
  UPDATE public.technical_configuration_dossiers
  SET revision = revision + 1, updated_at = now(), updated_by = v_user_id
  WHERE id = p_target_dossier_id
  RETURNING revision INTO v_dossier_revision;
  SELECT revision INTO v_target_revision
  FROM public.technical_configuration_baseline_versions
  WHERE id = v_target_version_id;
  RETURN jsonb_build_object('data', jsonb_build_object(
    'mode', v_mode, 'target_dossier_id', p_target_dossier_id,
    'target_dossier_revision', v_dossier_revision,
    'target_baseline_version_id', v_target_version_id,
    'target_baseline_revision', v_target_revision,
    'source_baseline_version_id', p_source_baseline_version_id,
    'copied_counts', v_data->'copy_counts',
    'deleted_counts', v_data->'delete_counts',
    'preserved_counts', v_data->'preserved_counts'
  ));
END;
$$;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_validate_source_lineage() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION technical_configuration_internal.baseline_cross_dossier_preview(UUID, UUID, BIGINT, UUID, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION technical_configuration_internal.baseline_cross_dossier_copy_rows(UUID, UUID, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.technical_configuration_baseline_cross_dossier_sources_list(UUID, TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.technical_configuration_baseline_cross_dossier_copy_preview(UUID, UUID, BIGINT, UUID, BIGINT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.technical_configuration_baseline_cross_dossier_copy_apply(UUID, UUID, BIGINT, UUID, BIGINT, TEXT, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_cross_dossier_sources_list(UUID, TEXT, INTEGER, INTEGER) FROM anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_cross_dossier_copy_preview(UUID, UUID, BIGINT, UUID, BIGINT) FROM anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_cross_dossier_copy_apply(UUID, UUID, BIGINT, UUID, BIGINT, TEXT, BOOLEAN) FROM anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_cross_dossier_sources_list(UUID, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_cross_dossier_copy_preview(UUID, UUID, BIGINT, UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_cross_dossier_copy_apply(UUID, UUID, BIGINT, UUID, BIGINT, TEXT, BOOLEAN) TO authenticated;
COMMIT;
