-- Return the canonical catalog UUID and align branding with trusted current tenant claims.
-- This forward-only migration preserves the existing RPC signatures and grants.
BEGIN;

CREATE OR REPLACE FUNCTION public.device_quota_regulatory_catalog_get()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims JSONB;
  v_role TEXT;
  v_effective_role TEXT;
  v_user_id BIGINT;
  v_don_vi BIGINT;
  v_user_id_text TEXT;
  v_don_vi_text TEXT;
  v_current_don_vi_text TEXT;
  v_version_id UUID;
  v_canonical_count INTEGER;
BEGIN
  BEGIN
    v_claims := COALESCE(
      NULLIF(current_setting('request.jwt.claims', true), ''),
      '{}'
    )::JSONB;
    v_role := NULLIF(v_claims->>'app_role', '');
    v_user_id_text := NULLIF(v_claims->>'user_id', '');
    v_don_vi_text := NULLIF(
      v_claims->>'don_vi',
      ''
    );
    v_current_don_vi_text := NULLIF(
      v_claims->>'current_don_vi',
      ''
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Missing or malformed JWT claims' USING errcode = '42501';
  END;

  IF v_role IS NULL OR v_user_id_text IS NULL THEN
    RAISE EXCEPTION 'Missing authenticated identity claims' USING errcode = '42501';
  END IF;

  v_effective_role := CASE
    WHEN v_role = 'admin' THEN 'global'
    ELSE v_role
  END;

  IF v_effective_role IN ('global', 'to_qltb') THEN
    v_don_vi_text := COALESCE(v_current_don_vi_text, v_don_vi_text);
  END IF;

  IF v_effective_role IS NULL OR v_effective_role NOT IN ('global', 'to_qltb') THEN
    RAISE EXCEPTION 'Insufficient permissions for regulatory catalog access'
      USING errcode = '42501';
  END IF;

  IF v_user_id_text !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'Missing user_id claim' USING errcode = '42501';
  END IF;

  IF v_don_vi_text IS NULL OR v_don_vi_text !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'Missing tenant claim' USING errcode = '42501';
  END IF;

  BEGIN
    v_user_id := v_user_id_text::BIGINT;
    v_don_vi := v_don_vi_text::BIGINT;
  EXCEPTION WHEN numeric_value_out_of_range THEN
    RAISE EXCEPTION 'Invalid session identity claims' USING errcode = '42501';
  END;

  IF NOT EXISTS (
    SELECT 1
    FROM public.nhan_vien AS nv
    WHERE nv.id = v_user_id
      AND COALESCE(nv.is_active, true)
      AND COALESCE(nv.current_don_vi, nv.don_vi) = v_don_vi
      AND CASE WHEN nv.role = 'admin' THEN 'global' ELSE nv.role END = v_effective_role
  ) THEN
    RAISE EXCEPTION 'Session user or tenant is not authorized'
      USING errcode = '42501';
  END IF;

  SELECT count(*)::INTEGER
  INTO v_canonical_count
  FROM public.device_quota_regulatory_catalog_versions AS v
  JOIN public.device_quota_regulatory_documents AS d ON d.id = v.document_id
  WHERE d.document_number = '10/2026/TT-BYT'
    AND v.import_status = 'ready'
    AND v.is_canonical
      AND device_quota_internal.catalog_is_complete(v.id);

  IF v_canonical_count <> 1 THEN
    RAISE EXCEPTION 'Canonical regulatory catalog snapshot is unavailable or invalid'
      USING errcode = '55000';
  END IF;

  SELECT v.id
  INTO v_version_id
  FROM public.device_quota_regulatory_catalog_versions AS v
  JOIN public.device_quota_regulatory_documents AS d ON d.id = v.document_id
  WHERE d.document_number = '10/2026/TT-BYT'
    AND v.import_status = 'ready'
    AND v.is_canonical
    AND device_quota_internal.catalog_is_complete(v.id)
  LIMIT 1;

  RETURN (
    SELECT jsonb_build_object(
      'document',
      jsonb_build_object(
        'document_number', d.document_number,
        'document_title', d.document_title,
        'appendix_title', d.appendix_title,
        'document_version', d.document_version,
        'issued_date', d.issued_date,
        'effective_date', d.effective_date,
        'source_pdf_path', d.source_pdf_path,
        'source_pdf_sha256', d.source_pdf_sha256
      ),
      'catalog_version',
      jsonb_build_object(
        'id', v.id,
        'artifact_id', v.artifact_id,
        'appendix_json_path', v.appendix_json_path,
        'appendix_json_sha256', v.appendix_json_sha256,
        'appendix_markdown_path', v.appendix_markdown_path,
        'appendix_markdown_sha256', v.appendix_markdown_sha256,
        'extraction_revision', v.extraction_revision,
        'import_status', v.import_status,
        'is_canonical', v.is_canonical,
        'source_pages', v.source_pages,
        'source_note', v.source_note
      ),
      'completeness',
      jsonb_build_object(
        'structural_rows', v.expected_structural_rows,
        'section_rows', v.expected_section_rows,
        'equipment_item_rows', v.expected_item_rows,
        'source_declared_child_rows', v.expected_child_item_rows,
        'top_level_item_rows', v.expected_top_level_item_rows,
        'rule_lines', v.expected_rule_lines,
        'footnotes', v.expected_footnotes,
        'items_with_source_pages', v.expected_items_with_source_pages,
        'items_with_source_references', v.expected_items_with_source_references,
        'multiline_quota_items', v.expected_multiline_items
      ),
      'rows',
      (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'id', p.source_identifier,
              'tt', p.source_label,
              'type', p.row_type,
              'level', p.source_level,
              'parent', p.parent_source_identifier,
              'name', CASE p.row_type
                WHEN 'section' THEN s.name
                WHEN 'item' THEN i.name
              END,
              'unit', i.original_unit,
              'quota', CASE
                WHEN i.id IS NULL THEN NULL
                ELSE to_jsonb(i.quota_lines)
              END,
              'source_pages',
              (
                SELECT jsonb_agg(sp.page_number ORDER BY sp.page_order)
                FROM public.device_quota_regulatory_source_pages AS sp
                WHERE sp.source_position_id = p.id
              ),
              'source_ref',
              (
                SELECT r.reference_text
                FROM public.device_quota_regulatory_references AS r
                WHERE r.source_position_id = p.id
                  AND r.reference_type = 'source'
              )
            )
            ORDER BY p.source_order
          ),
          '[]'::JSONB
        )
        FROM public.device_quota_regulatory_source_positions AS p
        LEFT JOIN public.device_quota_regulatory_sections AS s ON s.id = p.section_id
        LEFT JOIN public.device_quota_regulatory_items AS i ON i.id = p.item_id
        WHERE p.catalog_version_id = v.id
      ),
      'footnotes',
      (
        SELECT COALESCE(
          jsonb_agg(r.reference_text ORDER BY r.reference_order),
          '[]'::JSONB
        )
        FROM public.device_quota_regulatory_references AS r
        WHERE r.catalog_version_id = v.id
          AND r.reference_type = 'footnote'
      )
    )
    FROM public.device_quota_regulatory_catalog_versions AS v
    JOIN public.device_quota_regulatory_documents AS d ON d.id = v.document_id
    WHERE v.id = v_version_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.device_quota_regulatory_catalog_get()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.device_quota_regulatory_catalog_get()
  TO authenticated;

CREATE OR REPLACE FUNCTION public.don_vi_branding_get(p_id bigint DEFAULT NULL)
RETURNS TABLE (
  id bigint,
  name text,
  logo_url text,
  print_location text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_role text;
  v_role_fallback text;
  v_effective_role text;
  v_user_id text;
  v_claim_don_vi_text text;
  v_claim_current_don_vi_text text;
  v_claim_don_vi bigint;
  v_claim_current_don_vi bigint;
  v_effective_id bigint;
BEGIN
  v_role := lower(coalesce(public._get_jwt_claim('app_role')::text, ''));
  v_role_fallback := lower(coalesce(public._get_jwt_claim('role')::text, ''));
  IF v_role = '' THEN
    v_role := v_role_fallback;
  END IF;
  v_effective_role := CASE
    WHEN v_role = 'admin' THEN 'global'
    ELSE v_role
  END;

  v_user_id := NULLIF(public._get_jwt_claim('user_id'), '');
  IF v_effective_role IS NULL OR v_effective_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING errcode = '42501';
  END IF;
  IF v_user_id IS NULL OR v_user_id !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'Missing user_id claim' USING errcode = '42501';
  END IF;
  v_claim_don_vi_text := NULLIF(public._get_jwt_claim('don_vi'), '');
  v_claim_current_don_vi_text := NULLIF(public._get_jwt_claim('current_don_vi'), '');
  IF v_claim_don_vi_text IS NOT NULL AND v_claim_don_vi_text !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'Invalid don_vi claim' USING errcode = '42501';
  END IF;
  IF v_claim_current_don_vi_text IS NOT NULL
     AND v_claim_current_don_vi_text !~ '^[0-9]+$'
  THEN
    RAISE EXCEPTION 'Invalid current_don_vi claim' USING errcode = '42501';
  END IF;

  v_claim_don_vi := v_claim_don_vi_text::bigint;
  v_claim_current_don_vi := v_claim_current_don_vi_text::bigint;

  -- Equipment-manager JWTs carry the trusted current tenant; fall back only when absent.
  IF v_effective_role IN ('global', 'to_qltb') THEN
    v_claim_don_vi := COALESCE(v_claim_current_don_vi, v_claim_don_vi);
  END IF;

  IF v_effective_role <> 'global' AND v_claim_don_vi IS NULL THEN
    RAISE EXCEPTION 'Missing don_vi claim' USING errcode = '42501';
  END IF;

  IF v_effective_role = 'global' THEN
    v_effective_id := COALESCE(p_id, v_claim_don_vi);
  ELSE
    v_effective_id := v_claim_don_vi;
    IF v_effective_id IS NULL THEN
      RAISE EXCEPTION 'Thiếu thông tin đơn vị trong phiên đăng nhập'
        USING HINT = 'missing_don_vi_claim';
    END IF;
    IF p_id IS NOT NULL AND p_id <> v_effective_id THEN
      RAISE EXCEPTION 'Forbidden'
        USING HINT = 'tenant_mismatch';
    END IF;
  END IF;

  IF v_effective_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    d.id,
    d.name,
    d.logo_url,
    db.ten_dia_ban AS print_location
  FROM public.don_vi d
  LEFT JOIN public.dia_ban db ON db.id = d.dia_ban_id
  WHERE d.id = v_effective_id;
END;
$$;

COMMIT;
