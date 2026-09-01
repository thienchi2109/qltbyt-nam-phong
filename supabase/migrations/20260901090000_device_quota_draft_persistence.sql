-- Phase 2: isolated unit draft persistence and guarded mutation for the
-- immutable Thong tu 10/2026 regulatory catalog.
--
-- This migration does not write active category, decision, equipment,
-- compliance, report, or Excel-import tables.

BEGIN;

CREATE UNIQUE INDEX device_quota_regulatory_items_id_catalog_version_key
  ON public.device_quota_regulatory_items (id, catalog_version_id);

CREATE TABLE public.device_quota_unit_catalog_draft (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  don_vi BIGINT NOT NULL REFERENCES public.don_vi(id),
  catalog_version_id UUID NOT NULL
    REFERENCES public.device_quota_regulatory_catalog_versions(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status = 'draft'),
  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_by BIGINT NOT NULL REFERENCES public.nhan_vien(id),
  updated_by BIGINT NOT NULL REFERENCES public.nhan_vien(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, catalog_version_id)
);

CREATE UNIQUE INDEX device_quota_unit_catalog_one_editable_draft_idx
  ON public.device_quota_unit_catalog_draft (don_vi)
  WHERE status = 'draft';

CREATE TABLE public.device_quota_unit_catalog_draft_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NOT NULL,
  catalog_version_id UUID NOT NULL,
  regulatory_item_id UUID NOT NULL,
  display_name_override TEXT,
  applied_unit TEXT,
  applied_quantity INTEGER CHECK (
    applied_quantity IS NULL OR applied_quantity >= 0
  ),
  notes TEXT,
  is_excluded BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL CHECK (display_order > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (draft_id, regulatory_item_id),
  FOREIGN KEY (draft_id, catalog_version_id)
    REFERENCES public.device_quota_unit_catalog_draft (id, catalog_version_id),
  FOREIGN KEY (regulatory_item_id, catalog_version_id)
    REFERENCES public.device_quota_regulatory_items (id, catalog_version_id)
);

CREATE TABLE public.device_quota_unit_catalog_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NOT NULL REFERENCES public.device_quota_unit_catalog_draft(id),
  don_vi BIGINT NOT NULL REFERENCES public.don_vi(id),
  actor_user_id BIGINT NOT NULL REFERENCES public.nhan_vien(id),
  event_type TEXT NOT NULL CHECK (
    event_type IN ('create', 'save', 'exclude', 'restore')
  ),
  before_state JSONB NOT NULL,
  after_state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX device_quota_unit_catalog_audit_logs_draft_idx
  ON public.device_quota_unit_catalog_audit_logs (draft_id, created_at);

CREATE OR REPLACE FUNCTION device_quota_internal.require_unit_catalog_session(
  p_mutation BOOLEAN
)
RETURNS TABLE (
  user_id BIGINT,
  don_vi BIGINT,
  effective_role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims JSONB;
  v_role TEXT;
  v_effective_role TEXT;
  v_user_id_text TEXT;
  v_don_vi_text TEXT;
  v_user_id BIGINT;
  v_don_vi BIGINT;
BEGIN
  BEGIN
    v_claims := COALESCE(
      NULLIF(current_setting('request.jwt.claims', true), ''),
      '{}'
    )::JSONB;
    v_role := LOWER(NULLIF(v_claims->>'app_role', ''));
    v_user_id_text := NULLIF(v_claims->>'user_id', '');
    v_don_vi_text := NULLIF(v_claims->>'don_vi', '');
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Missing or malformed JWT claims' USING ERRCODE = '42501';
  END;

  IF v_role IS NULL OR v_user_id_text IS NULL OR v_don_vi_text IS NULL THEN
    RAISE EXCEPTION 'Missing authenticated session claims' USING ERRCODE = '42501';
  END IF;

  IF v_user_id_text !~ '^[0-9]+$' OR v_don_vi_text !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'Invalid authenticated session claims' USING ERRCODE = '42501';
  END IF;

  BEGIN
    v_user_id := v_user_id_text::BIGINT;
    v_don_vi := v_don_vi_text::BIGINT;
  EXCEPTION WHEN numeric_value_out_of_range THEN
    RAISE EXCEPTION 'Invalid authenticated session claims' USING ERRCODE = '42501';
  END;

  v_effective_role := CASE WHEN v_role = 'admin' THEN 'global' ELSE v_role END;

  -- regional_leader is the current mapping-only role: it may read a
  -- session-scoped draft, but it cannot create or mutate one.
  IF v_effective_role NOT IN ('global', 'to_qltb', 'regional_leader') THEN
    RAISE EXCEPTION 'Insufficient permissions for unit catalog draft'
      USING ERRCODE = '42501';
  END IF;

  IF p_mutation AND v_effective_role NOT IN ('global', 'to_qltb') THEN
    RAISE EXCEPTION 'Mapping-only roles cannot mutate unit catalog drafts'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.nhan_vien AS nv
    WHERE nv.id = v_user_id
      AND COALESCE(nv.is_active, true)
      AND COALESCE(nv.current_don_vi, nv.don_vi) = v_don_vi
      AND CASE WHEN nv.role = 'admin' THEN 'global' ELSE nv.role END = v_effective_role
  ) THEN
    RAISE EXCEPTION 'Session user or unit is not authorized'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY SELECT v_user_id, v_don_vi, v_effective_role;
END;
$$;

CREATE OR REPLACE FUNCTION device_quota_internal.canonical_catalog_version()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_version_id UUID;
  v_count INTEGER;
BEGIN
  SELECT count(*)::INTEGER
  INTO v_count
  FROM public.device_quota_regulatory_catalog_versions AS v
  JOIN public.device_quota_regulatory_documents AS d
    ON d.id = v.document_id
  WHERE d.document_number = '10/2026/TT-BYT'
    AND v.import_status = 'ready'
    AND v.is_canonical
    AND device_quota_internal.catalog_is_complete(v.id);

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Canonical regulatory catalog snapshot is unavailable or invalid'
      USING ERRCODE = '55000';
  END IF;

  SELECT v.id
  INTO v_version_id
  FROM public.device_quota_regulatory_catalog_versions AS v
  JOIN public.device_quota_regulatory_documents AS d
    ON d.id = v.document_id
  WHERE d.document_number = '10/2026/TT-BYT'
    AND v.import_status = 'ready'
    AND v.is_canonical
    AND device_quota_internal.catalog_is_complete(v.id)
  LIMIT 1;

  RETURN v_version_id;
END;
$$;

CREATE OR REPLACE FUNCTION device_quota_internal.draft_snapshot(
  p_draft_id UUID
)
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'draft',
    jsonb_build_object(
      'id', d.id,
      'don_vi', d.don_vi,
      'catalog_version_id', d.catalog_version_id,
      'status', d.status,
      'revision', d.revision,
      'created_by', d.created_by,
      'updated_by', d.updated_by,
      'created_at', d.created_at,
      'updated_at', d.updated_at
    ),
    'items',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', di.id,
            'regulatory_item_id', di.regulatory_item_id,
            'display_name_override', di.display_name_override,
            'applied_unit', di.applied_unit,
            'applied_quantity', di.applied_quantity,
            'notes', di.notes,
            'is_excluded', di.is_excluded,
            'display_order', di.display_order,
            'source_identifier', ri.source_identifier,
            'source_label', ri.source_label,
            'regulatory_name', ri.name,
            'regulatory_unit', ri.original_unit,
            'regulatory_quota_lines', to_jsonb(ri.quota_lines),
            'regulatory_rules',
            COALESCE(
              (
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'line_order', rr.line_order,
                    'source_text', rr.source_text
                  )
                  ORDER BY rr.line_order
                )
                FROM public.device_quota_regulatory_rules AS rr
                WHERE rr.item_id = ri.id
              ),
              '[]'::JSONB
            )
          )
          ORDER BY di.display_order
        )
        FROM public.device_quota_unit_catalog_draft_item AS di
        JOIN public.device_quota_regulatory_items AS ri
          ON ri.id = di.regulatory_item_id
         AND ri.catalog_version_id = di.catalog_version_id
        WHERE di.draft_id = d.id
      ),
      '[]'::JSONB
    )
  )
  FROM public.device_quota_unit_catalog_draft AS d
  WHERE d.id = p_draft_id;
$$;

CREATE OR REPLACE FUNCTION public.device_quota_unit_catalog_draft_create_or_open()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims JSONB;
  v_role TEXT;
  v_user_id_text TEXT;
  v_session RECORD;
  v_catalog_version_id UUID;
  v_draft_id UUID;
  v_created BOOLEAN;
  v_snapshot JSONB;
BEGIN
  BEGIN
    v_claims := COALESCE(
      NULLIF(current_setting('request.jwt.claims', true), ''),
      '{}'
    )::JSONB;
    v_role := NULLIF(v_claims->>'app_role', '');
    v_user_id_text := NULLIF(v_claims->>'user_id', '');
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Missing or malformed JWT claims' USING ERRCODE = '42501';
  END;

  IF v_role IS NULL OR v_user_id_text IS NULL THEN
    RAISE EXCEPTION 'Missing authenticated identity claims' USING ERRCODE = '42501';
  END IF;

  v_created := false;

  SELECT * INTO v_session
  FROM device_quota_internal.require_unit_catalog_session(true);

  v_catalog_version_id := device_quota_internal.canonical_catalog_version();

  INSERT INTO public.device_quota_unit_catalog_draft (
    don_vi,
    catalog_version_id,
    created_by,
    updated_by
  )
  VALUES (
    v_session.don_vi,
    v_catalog_version_id,
    v_session.user_id,
    v_session.user_id
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_draft_id;

  IF v_draft_id IS NULL THEN
    SELECT d.id
    INTO v_draft_id
    FROM public.device_quota_unit_catalog_draft AS d
    WHERE d.don_vi = v_session.don_vi
      AND d.status = 'draft'
    FOR UPDATE;
  ELSE
    v_created := true;

    INSERT INTO public.device_quota_unit_catalog_draft_item (
      draft_id,
      catalog_version_id,
      regulatory_item_id,
      display_order
    )
    SELECT
      v_draft_id,
      ri.catalog_version_id,
      ri.id,
      ri.source_order
    FROM public.device_quota_regulatory_items AS ri
    WHERE ri.catalog_version_id = v_catalog_version_id
    ORDER BY ri.source_order;
  END IF;

  v_snapshot := device_quota_internal.draft_snapshot(v_draft_id);

  IF v_created THEN
    INSERT INTO public.device_quota_unit_catalog_audit_logs (
      draft_id,
      don_vi,
      actor_user_id,
      event_type,
      before_state,
      after_state
    )
    VALUES (
      v_draft_id,
      v_session.don_vi,
      v_session.user_id,
      'create',
      '{}'::JSONB,
      v_snapshot
    );
  END IF;

  RETURN jsonb_build_object('data', v_snapshot);
END;
$$;

CREATE OR REPLACE FUNCTION public.device_quota_unit_catalog_draft_get(
  p_draft_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims JSONB;
  v_role TEXT;
  v_user_id_text TEXT;
  v_session RECORD;
  v_draft_id UUID;
  v_snapshot JSONB;
BEGIN
  BEGIN
    v_claims := COALESCE(
      NULLIF(current_setting('request.jwt.claims', true), ''),
      '{}'
    )::JSONB;
    v_role := NULLIF(v_claims->>'app_role', '');
    v_user_id_text := NULLIF(v_claims->>'user_id', '');
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Missing or malformed JWT claims' USING ERRCODE = '42501';
  END;

  IF v_role IS NULL OR v_user_id_text IS NULL THEN
    RAISE EXCEPTION 'Missing authenticated identity claims' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_session
  FROM device_quota_internal.require_unit_catalog_session(false);

  SELECT d.id
  INTO v_draft_id
  FROM public.device_quota_unit_catalog_draft AS d
  WHERE d.don_vi = v_session.don_vi
    AND d.status = 'draft'
    AND (p_draft_id IS NULL OR d.id = p_draft_id);

  IF v_draft_id IS NULL THEN
    RETURN jsonb_build_object('data', NULL);
  END IF;

  v_snapshot := device_quota_internal.draft_snapshot(v_draft_id);
  RETURN jsonb_build_object('data', v_snapshot);
END;
$$;

CREATE OR REPLACE FUNCTION public.device_quota_unit_catalog_draft_save(
  p_draft_id UUID,
  p_expected_revision BIGINT,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims JSONB;
  v_role TEXT;
  v_user_id_text TEXT;
  v_session RECORD;
  v_draft RECORD;
  v_before JSONB;
  v_after JSONB;
  v_input_count INTEGER;
  v_distinct_count INTEGER;
  v_unknown_count INTEGER;
BEGIN
  BEGIN
    v_claims := COALESCE(
      NULLIF(current_setting('request.jwt.claims', true), ''),
      '{}'
    )::JSONB;
    v_role := NULLIF(v_claims->>'app_role', '');
    v_user_id_text := NULLIF(v_claims->>'user_id', '');
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Missing or malformed JWT claims' USING ERRCODE = '42501';
  END;

  IF v_role IS NULL OR v_user_id_text IS NULL THEN
    RAISE EXCEPTION 'Missing authenticated identity claims' USING ERRCODE = '42501';
  END IF;

  -- Regulatory source fields are immutable; this payload contains only unit
  -- overrides and draft state.
  SELECT * INTO v_session
  FROM device_quota_internal.require_unit_catalog_session(true);

  IF p_expected_revision IS NULL THEN
    RAISE EXCEPTION 'expected_revision is required' USING ERRCODE = '22023';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'items must be a JSON array' USING ERRCODE = '22023';
  END IF;

  SELECT d.*
  INTO v_draft
  FROM public.device_quota_unit_catalog_draft AS d
  WHERE d.id = p_draft_id
    AND d.don_vi = v_session.don_vi
    AND d.status = 'draft'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  IF v_draft.revision IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'stale_revision' USING ERRCODE = 'PT409';
  END IF;

  SELECT count(*)::INTEGER, count(DISTINCT incoming.regulatory_item_id)::INTEGER
  INTO v_input_count, v_distinct_count
  FROM jsonb_to_recordset(p_items) AS incoming(
    regulatory_item_id UUID,
    display_name_override TEXT,
    applied_unit TEXT,
    applied_quantity INTEGER,
    notes TEXT,
    is_excluded BOOLEAN,
    display_order INTEGER
  );

  IF v_input_count <> v_distinct_count THEN
    RAISE EXCEPTION 'Duplicate regulatory item in draft payload'
      USING ERRCODE = '23505';
  END IF;

  SELECT count(*)::INTEGER
  INTO v_unknown_count
  FROM jsonb_to_recordset(p_items) AS incoming(
    regulatory_item_id UUID,
    display_name_override TEXT,
    applied_unit TEXT,
    applied_quantity INTEGER,
    notes TEXT,
    is_excluded BOOLEAN,
    display_order INTEGER
  )
  WHERE incoming.regulatory_item_id IS NULL
     OR incoming.display_order IS NULL
     OR incoming.display_order <= 0
     OR incoming.is_excluded IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM public.device_quota_unit_catalog_draft_item AS existing_item
       WHERE existing_item.draft_id = v_draft.id
         AND existing_item.regulatory_item_id = incoming.regulatory_item_id
     );

  IF v_unknown_count > 0 THEN
    RAISE EXCEPTION 'Invalid item in draft payload' USING ERRCODE = '22023';
  END IF;

  v_before := device_quota_internal.draft_snapshot(v_draft.id);

  UPDATE public.device_quota_unit_catalog_draft_item AS target
  SET
    display_name_override = incoming.display_name_override,
    applied_unit = incoming.applied_unit,
    applied_quantity = incoming.applied_quantity,
    notes = incoming.notes,
    is_excluded = incoming.is_excluded,
    display_order = incoming.display_order,
    updated_at = now()
  FROM jsonb_to_recordset(p_items) AS incoming(
    regulatory_item_id UUID,
    display_name_override TEXT,
    applied_unit TEXT,
    applied_quantity INTEGER,
    notes TEXT,
    is_excluded BOOLEAN,
    display_order INTEGER
  )
  WHERE target.draft_id = v_draft.id
    AND target.regulatory_item_id = incoming.regulatory_item_id;

  UPDATE public.device_quota_unit_catalog_draft
  SET revision = revision + 1,
      updated_by = v_session.user_id,
      updated_at = now()
  WHERE id = v_draft.id;

  v_after := device_quota_internal.draft_snapshot(v_draft.id);

  INSERT INTO public.device_quota_unit_catalog_audit_logs (
    draft_id,
    don_vi,
    actor_user_id,
    event_type,
    before_state,
    after_state
  )
  VALUES (
    v_draft.id,
    v_session.don_vi,
    v_session.user_id,
    'save',
    v_before,
    v_after
  );

  RETURN jsonb_build_object('data', v_after);
END;
$$;

CREATE OR REPLACE FUNCTION public.device_quota_unit_catalog_draft_exclude(
  p_draft_id UUID,
  p_regulatory_item_id UUID,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims JSONB;
  v_role TEXT;
  v_user_id_text TEXT;
  v_session RECORD;
  v_draft RECORD;
  v_before JSONB;
  v_after JSONB;
BEGIN
  BEGIN
    v_claims := COALESCE(
      NULLIF(current_setting('request.jwt.claims', true), ''),
      '{}'
    )::JSONB;
    v_role := NULLIF(v_claims->>'app_role', '');
    v_user_id_text := NULLIF(v_claims->>'user_id', '');
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Missing or malformed JWT claims' USING ERRCODE = '42501';
  END;

  IF v_role IS NULL OR v_user_id_text IS NULL THEN
    RAISE EXCEPTION 'Missing authenticated identity claims' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_session
  FROM device_quota_internal.require_unit_catalog_session(true);

  IF p_expected_revision IS NULL THEN
    RAISE EXCEPTION 'expected_revision is required' USING ERRCODE = '22023';
  END IF;

  SELECT d.*
  INTO v_draft
  FROM public.device_quota_unit_catalog_draft AS d
  WHERE d.id = p_draft_id
    AND d.don_vi = v_session.don_vi
    AND d.status = 'draft'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  IF v_draft.revision IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'stale_revision' USING ERRCODE = 'PT409';
  END IF;

  v_before := device_quota_internal.draft_snapshot(v_draft.id);

  UPDATE public.device_quota_unit_catalog_draft_item
  SET is_excluded = true, updated_at = now()
  WHERE draft_id = v_draft.id
    AND regulatory_item_id = p_regulatory_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  UPDATE public.device_quota_unit_catalog_draft
  SET revision = revision + 1,
      updated_by = v_session.user_id,
      updated_at = now()
  WHERE id = v_draft.id;

  v_after := device_quota_internal.draft_snapshot(v_draft.id);

  INSERT INTO public.device_quota_unit_catalog_audit_logs (
    draft_id,
    don_vi,
    actor_user_id,
    event_type,
    before_state,
    after_state
  )
  VALUES (
    v_draft.id,
    v_session.don_vi,
    v_session.user_id,
    'exclude',
    v_before,
    v_after
  );

  RETURN jsonb_build_object('data', v_after);
END;
$$;

CREATE OR REPLACE FUNCTION public.device_quota_unit_catalog_draft_restore(
  p_draft_id UUID,
  p_regulatory_item_id UUID,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims JSONB;
  v_role TEXT;
  v_user_id_text TEXT;
  v_session RECORD;
  v_draft RECORD;
  v_before JSONB;
  v_after JSONB;
BEGIN
  BEGIN
    v_claims := COALESCE(
      NULLIF(current_setting('request.jwt.claims', true), ''),
      '{}'
    )::JSONB;
    v_role := NULLIF(v_claims->>'app_role', '');
    v_user_id_text := NULLIF(v_claims->>'user_id', '');
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Missing or malformed JWT claims' USING ERRCODE = '42501';
  END;

  IF v_role IS NULL OR v_user_id_text IS NULL THEN
    RAISE EXCEPTION 'Missing authenticated identity claims' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_session
  FROM device_quota_internal.require_unit_catalog_session(true);

  IF p_expected_revision IS NULL THEN
    RAISE EXCEPTION 'expected_revision is required' USING ERRCODE = '22023';
  END IF;

  SELECT d.*
  INTO v_draft
  FROM public.device_quota_unit_catalog_draft AS d
  WHERE d.id = p_draft_id
    AND d.don_vi = v_session.don_vi
    AND d.status = 'draft'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  IF v_draft.revision IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'stale_revision' USING ERRCODE = 'PT409';
  END IF;

  v_before := device_quota_internal.draft_snapshot(v_draft.id);

  UPDATE public.device_quota_unit_catalog_draft_item
  SET is_excluded = false, updated_at = now()
  WHERE draft_id = v_draft.id
    AND regulatory_item_id = p_regulatory_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  UPDATE public.device_quota_unit_catalog_draft
  SET revision = revision + 1,
      updated_by = v_session.user_id,
      updated_at = now()
  WHERE id = v_draft.id;

  v_after := device_quota_internal.draft_snapshot(v_draft.id);

  INSERT INTO public.device_quota_unit_catalog_audit_logs (
    draft_id,
    don_vi,
    actor_user_id,
    event_type,
    before_state,
    after_state
  )
  VALUES (
    v_draft.id,
    v_session.don_vi,
    v_session.user_id,
    'restore',
    v_before,
    v_after
  );

  RETURN jsonb_build_object('data', v_after);
END;
$$;

ALTER TABLE public.device_quota_unit_catalog_draft ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_quota_unit_catalog_draft_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_quota_unit_catalog_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY device_quota_unit_catalog_draft_no_client_access
  ON public.device_quota_unit_catalog_draft
  FOR ALL TO public
  USING (false)
  WITH CHECK (false);

CREATE POLICY device_quota_unit_catalog_draft_item_no_client_access
  ON public.device_quota_unit_catalog_draft_item
  FOR ALL TO public
  USING (false)
  WITH CHECK (false);

CREATE POLICY device_quota_unit_catalog_audit_logs_no_client_access
  ON public.device_quota_unit_catalog_audit_logs
  FOR ALL TO public
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON TABLE public.device_quota_unit_catalog_draft
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.device_quota_unit_catalog_draft_item
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.device_quota_unit_catalog_audit_logs
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.device_quota_unit_catalog_draft_create_or_open()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.device_quota_unit_catalog_draft_get(UUID)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.device_quota_unit_catalog_draft_save(UUID, BIGINT, JSONB)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.device_quota_unit_catalog_draft_exclude(UUID, UUID, BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.device_quota_unit_catalog_draft_restore(UUID, UUID, BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.device_quota_unit_catalog_draft_create_or_open()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.device_quota_unit_catalog_draft_get(UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.device_quota_unit_catalog_draft_save(UUID, BIGINT, JSONB)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.device_quota_unit_catalog_draft_exclude(UUID, UUID, BIGINT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.device_quota_unit_catalog_draft_restore(UUID, UUID, BIGINT)
  TO authenticated;

REVOKE ALL ON FUNCTION device_quota_internal.require_unit_catalog_session(BOOLEAN)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION device_quota_internal.canonical_catalog_version()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION device_quota_internal.draft_snapshot(UUID)
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
