BEGIN;

CREATE FUNCTION pg_temp.expect_error(
  p_label TEXT,
  p_statement TEXT,
  p_expected_state TEXT,
  p_expected_message TEXT DEFAULT NULL
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
      IF v_state = p_expected_state
         AND (p_expected_message IS NULL OR v_message = p_expected_message) THEN
        RETURN;
      END IF;
      RAISE EXCEPTION '%: expected %/% got %/%',
        p_label,
        p_expected_state,
        COALESCE(p_expected_message, '<any message>'),
        v_state,
        v_message;
  END;
  RAISE EXCEPTION '%: expected statement to fail', p_label;
END;
$gate$;

CREATE FUNCTION pg_temp.set_claims(
  p_app_role TEXT,
  p_user_id BIGINT,
  p_don_vi BIGINT
)
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
      'sub', p_user_id::TEXT,
      'don_vi', p_don_vi::TEXT
    )::TEXT,
    true
  );
END;
$gate$;

DO $gate$
DECLARE
  v_writer_a_id BIGINT;
  v_writer_a_unit BIGINT;
  v_writer_a_role TEXT;
  v_writer_b_id BIGINT;
  v_writer_b_unit BIGINT;
  v_writer_b_role TEXT;
  v_unauthorized_id BIGINT;
  v_unauthorized_unit BIGINT;
  v_unauthorized_role TEXT;
  v_draft_a UUID;
  v_draft_b UUID;
  v_item_a UUID;
  v_item_b UUID;
  v_foreign_item UUID;
  v_response JSONB;
  v_payload JSONB;
  v_revision_a BIGINT;
  v_revision_b BIGINT;
BEGIN
  SELECT
    nv.id,
    COALESCE(nv.current_don_vi, nv.don_vi),
    LOWER(nv.role)
  INTO v_writer_a_id, v_writer_a_unit, v_writer_a_role
  FROM public.nhan_vien AS nv
  WHERE COALESCE(nv.is_active, true)
    AND LOWER(nv.role) IN ('admin', 'global', 'to_qltb')
    AND COALESCE(nv.current_don_vi, nv.don_vi) IS NOT NULL
  ORDER BY nv.id
  LIMIT 1;

  ASSERT v_writer_a_id IS NOT NULL,
    'security gate needs one active draft-management user';
  ASSERT v_writer_a_unit IS NOT NULL,
    'security gate needs a session unit for writer A';

  SELECT
    nv.id,
    COALESCE(nv.current_don_vi, nv.don_vi),
    LOWER(nv.role)
  INTO v_writer_b_id, v_writer_b_unit, v_writer_b_role
  FROM public.nhan_vien AS nv
  WHERE COALESCE(nv.is_active, true)
    AND LOWER(nv.role) IN ('admin', 'global', 'to_qltb')
    AND COALESCE(nv.current_don_vi, nv.don_vi) IS NOT NULL
    AND nv.id <> v_writer_a_id
    AND COALESCE(nv.current_don_vi, nv.don_vi) <> v_writer_a_unit
  ORDER BY nv.id
  LIMIT 1;

  ASSERT v_writer_b_id IS NOT NULL,
    'security gate needs an authorized writer in a second unit';
  ASSERT v_writer_b_unit IS NOT NULL,
    'security gate needs a session unit for writer B';

  SELECT
    nv.id,
    COALESCE(nv.current_don_vi, nv.don_vi),
    LOWER(nv.role)
  INTO v_unauthorized_id, v_unauthorized_unit, v_unauthorized_role
  FROM public.nhan_vien AS nv
  WHERE COALESCE(nv.is_active, true)
    AND LOWER(nv.role) NOT IN ('admin', 'global', 'to_qltb', 'regional_leader')
    AND COALESCE(nv.current_don_vi, nv.don_vi) IS NOT NULL
  ORDER BY nv.id
  LIMIT 1;

  ASSERT v_unauthorized_id IS NOT NULL,
    'security gate needs one active unsupported-role user';

  PERFORM pg_temp.set_claims(v_writer_a_role, v_writer_a_id, v_writer_a_unit);
  v_response := public.device_quota_unit_catalog_draft_create_or_open();
  v_draft_a := (v_response->'data'->'draft'->>'id')::UUID;
  v_revision_a := (v_response->'data'->'draft'->>'revision')::BIGINT;

  SELECT (v_response->'data'->'items'->0->>'regulatory_item_id')::UUID
  INTO v_item_a;

  SELECT jsonb_agg(
    jsonb_build_object(
      'regulatory_item_id', regulatory_item_id,
      'display_name_override', display_name_override,
      'applied_unit', applied_unit,
      'applied_quantity', applied_quantity,
      'notes', notes,
      'is_excluded', is_excluded,
      'display_order', display_order
    )
    ORDER BY display_order
  )
  INTO v_payload
  FROM public.device_quota_unit_catalog_draft_item
  WHERE draft_id = v_draft_a;

  PERFORM pg_temp.set_claims(v_writer_b_role, v_writer_b_id, v_writer_b_unit);
  v_response := public.device_quota_unit_catalog_draft_create_or_open();
  v_draft_b := (v_response->'data'->'draft'->>'id')::UUID;
  v_revision_b := (v_response->'data'->'draft'->>'revision')::BIGINT;
  SELECT (v_response->'data'->'items'->0->>'regulatory_item_id')::UUID
  INTO v_item_b;

  ASSERT v_draft_a IS DISTINCT FROM v_draft_b,
    'security gate fixtures must produce drafts in different units';

  -- Missing session unit is rejected before any draft lookup or mutation.
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', v_writer_a_role,
      'role', 'authenticated',
      'user_id', v_writer_a_id::TEXT,
      'sub', v_writer_a_id::TEXT
    )::TEXT,
    true
  );
  PERFORM pg_temp.expect_error(
    'missing session unit',
    'SELECT public.device_quota_unit_catalog_draft_create_or_open()',
    '42501',
    'Missing authenticated session claims'
  );

  -- Unsupported roles cannot reach the draft RPCs, even with a valid unit.
  PERFORM pg_temp.set_claims(
    v_unauthorized_role,
    v_unauthorized_id,
    v_unauthorized_unit
  );
  PERFORM pg_temp.expect_error(
    'unsupported role',
    'SELECT public.device_quota_unit_catalog_draft_get(NULL::UUID)',
    '42501',
    'Insufficient permissions for unit catalog draft'
  );

  -- A caller-supplied unit override cannot be used with another user identity.
  PERFORM pg_temp.set_claims(v_writer_a_role, v_writer_a_id, v_writer_b_unit);
  PERFORM pg_temp.expect_error(
    'caller supplied unit override',
    format(
      'SELECT public.device_quota_unit_catalog_draft_get(%L::UUID)',
      v_draft_a
    ),
    '42501',
    'Session user or unit is not authorized'
  );

  -- Draft B is never visible or mutable from writer A's tenant.
  PERFORM pg_temp.set_claims(v_writer_a_role, v_writer_a_id, v_writer_a_unit);
  v_response := public.device_quota_unit_catalog_draft_get(v_draft_b);
  ASSERT v_response->'data' = 'null'::JSONB,
    'cross-tenant draft reads must return no data';
  PERFORM pg_temp.expect_error(
    'cross-tenant save',
    format(
      'SELECT public.device_quota_unit_catalog_draft_save(%L::UUID, %s, %L::JSONB)',
      v_draft_b,
      v_revision_b,
      v_payload::TEXT
    ),
    'PT404',
    'not_found'
  );
  PERFORM pg_temp.expect_error(
    'cross-tenant exclude',
    format(
      'SELECT public.device_quota_unit_catalog_draft_exclude(%L::UUID, %L::UUID, %s)',
      v_draft_b,
      v_item_b,
      v_revision_b
    ),
    'PT404',
    'not_found'
  );
  PERFORM pg_temp.expect_error(
    'cross-tenant restore',
    format(
      'SELECT public.device_quota_unit_catalog_draft_restore(%L::UUID, %L::UUID, %s)',
      v_draft_b,
      v_item_b,
      v_revision_b
    ),
    'PT404',
    'not_found'
  );

  -- Direct table reads remain denied to both Data API roles.
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM 1 FROM public.device_quota_unit_catalog_draft;
    RAISE EXCEPTION 'authenticated direct table access unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  RESET ROLE;

  SET LOCAL ROLE anon;
  BEGIN
    PERFORM 1 FROM public.device_quota_unit_catalog_draft;
    RAISE EXCEPTION 'anon direct table access unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  RESET ROLE;

  -- A regulatory item from another catalog version (or an unknown UUID when
  -- this baseline has one immutable version) cannot enter the draft payload.
  SELECT i.id
  INTO v_foreign_item
  FROM public.device_quota_regulatory_items AS i
  WHERE i.catalog_version_id <> (
    SELECT d.catalog_version_id
    FROM public.device_quota_unit_catalog_draft AS d
    WHERE d.id = v_draft_a
  )
  ORDER BY i.id
  LIMIT 1;
  v_foreign_item := COALESCE(v_foreign_item, gen_random_uuid());
  PERFORM pg_temp.expect_error(
    'source-version mismatch',
    format(
      'SELECT public.device_quota_unit_catalog_draft_save(%L::UUID, %s, %L::JSONB)',
      v_draft_a,
      v_revision_a,
      jsonb_build_array(
        jsonb_build_object(
          'regulatory_item_id', v_foreign_item,
          'catalog_version_id', gen_random_uuid(),
          'display_order', 1,
          'is_excluded', false
        )
      )::TEXT
    ),
    '22023',
    'Invalid item in draft payload'
  );

  -- Payload shape, duplicate items, and display-order invariants fail closed.
  PERFORM pg_temp.expect_error(
    'missing expected revision',
    format(
      'SELECT public.device_quota_unit_catalog_draft_save(%L::UUID, NULL::BIGINT, %L::JSONB)',
      v_draft_a,
      v_payload::TEXT
    ),
    '22023',
    'expected_revision is required'
  );
  PERFORM pg_temp.expect_error(
    'non-array payload',
    format(
      'SELECT public.device_quota_unit_catalog_draft_save(%L::UUID, %s, ''{}''::JSONB)',
      v_draft_a,
      v_revision_a
    ),
    '22023',
    'items must be a JSON array'
  );
  PERFORM pg_temp.expect_error(
    'duplicate item payload',
    format(
      'SELECT public.device_quota_unit_catalog_draft_save(%L::UUID, %s, %L::JSONB)',
      v_draft_a,
      v_revision_a,
      jsonb_build_array(v_payload->0, v_payload->0)::TEXT
    ),
    '23505',
    'Duplicate regulatory item in draft payload'
  );
  PERFORM pg_temp.expect_error(
    'invalid item fields',
    format(
      'SELECT public.device_quota_unit_catalog_draft_save(%L::UUID, %s, %L::JSONB)',
      v_draft_a,
      v_revision_a,
      jsonb_build_array(
        jsonb_build_object(
          'regulatory_item_id', v_item_a,
          'display_order', 0,
          'is_excluded', false
        )
      )::TEXT
    ),
    '22023',
    'Invalid item in draft payload'
  );

  -- The old revision cannot overwrite the newer save.
  v_response := public.device_quota_unit_catalog_draft_save(
    v_draft_a,
    v_revision_a,
    v_payload
  );
  PERFORM pg_temp.expect_error(
    'stale revision',
    format(
      'SELECT public.device_quota_unit_catalog_draft_save(%L::UUID, %s, %L::JSONB)',
      v_draft_a,
      v_revision_a,
      v_payload::TEXT
    ),
    'PT409',
    'stale_revision'
  );
END;
$gate$;

ROLLBACK;
