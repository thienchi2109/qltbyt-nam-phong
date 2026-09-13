-- Web Push Phase 4.5: candidate/config authorization and protected self-membership.
-- Additive only: the Phase 2 tables and worker wire remain compatible.
BEGIN;

ALTER TABLE public.web_push_recipient_configs
  ADD COLUMN protected_by_user_id BIGINT
    REFERENCES public.nhan_vien(id) ON DELETE CASCADE,
  ADD CONSTRAINT web_push_protected_self CHECK (protected_by_user_id IS NULL OR protected_by_user_id = user_id);

CREATE INDEX web_push_recipient_configs_protected_owner_idx
  ON public.web_push_recipient_configs(protected_by_user_id)
  WHERE protected_by_user_id IS NOT NULL;

-- Normal candidates are restricted to equipment managers in the target unit.
-- A non-null provenance owner is the separate protected-self exception.
CREATE FUNCTION public.web_push_recipient_is_eligible(
  p_user_id BIGINT,
  p_don_vi BIGINT,
  p_protected_by_user_id BIGINT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_profile RECORD;
BEGIN
  IF p_user_id IS NULL OR p_don_vi IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT
    nv.role,
    COALESCE(nv.current_don_vi, nv.don_vi) AS effective_don_vi,
    COALESCE(nv.dia_ban_id, dv.dia_ban_id) AS dia_ban_id
  INTO v_profile
  FROM public.nhan_vien nv
  LEFT JOIN public.don_vi dv
    ON dv.id = COALESCE(nv.current_don_vi, nv.don_vi)
  WHERE nv.id = p_user_id;

  IF NOT FOUND OR v_profile.dia_ban_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF p_protected_by_user_id IS NOT NULL THEN
    RETURN p_protected_by_user_id = p_user_id
      AND v_profile.role IN ('admin', 'global');
  END IF;

  RETURN v_profile.role = 'to_qltb'
    AND v_profile.effective_don_vi IS NOT DISTINCT FROM p_don_vi;
END;
$function$;

REVOKE ALL ON FUNCTION public.web_push_recipient_is_eligible(BIGINT, BIGINT, BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.web_push_recipient_config_get(p_don_vi BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_caller_id BIGINT;
  v_recipients JSONB;
BEGIN
  PERFORM public.web_push_config_authorize(p_don_vi);
  v_caller_id := public.web_push_session_user_id();

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'user_id', nv.id::TEXT,
        'username', nv.username,
        'full_name', nv.full_name,
        'status', CASE
          WHEN public.web_push_recipient_is_eligible(
            nv.id,
            p_don_vi,
            cfg.protected_by_user_id
          ) THEN 'eligible'
          ELSE 'ineligible'
        END,
        'protected', cfg.protected_by_user_id IS NOT NULL,
        'editable', cfg.protected_by_user_id IS NULL
          OR cfg.protected_by_user_id = v_caller_id
      )
      ORDER BY nv.id
    ),
    '[]'::JSONB
  )
  INTO v_recipients
  FROM public.web_push_recipient_configs cfg
  JOIN public.nhan_vien nv ON nv.id = cfg.user_id
  WHERE cfg.don_vi_id = p_don_vi;

  RETURN jsonb_build_object(
    'version', 1,
    'don_vi_id', p_don_vi::TEXT,
    'recipients', v_recipients
  );
END;
$function$;

-- Bounded, keyset-paginated account lookup. The caller/target authorization
-- is checked before any account rows are returned.
CREATE FUNCTION public.web_push_recipient_candidates(
  p_don_vi BIGINT,
  p_search TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_cursor BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_candidates JSONB;
  v_limit INTEGER;
  v_next_cursor BIGINT;
  v_search TEXT;
  v_has_more BOOLEAN;
BEGIN
  PERFORM public.web_push_config_authorize(p_don_vi);

  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100
    OR (p_cursor IS NOT NULL AND p_cursor < 1)
    OR (p_search IS NOT NULL AND octet_length(p_search) > 256) THEN
    RAISE EXCEPTION 'invalid_request' USING ERRCODE = '22023';
  END IF;

  v_limit := p_limit;
  v_search := public._sanitize_ilike_pattern(NULLIF(BTRIM(p_search), ''));

  WITH ranked AS (
    SELECT
      nv.id,
      nv.username,
      nv.full_name,
      row_number() OVER (ORDER BY nv.id) AS row_number
    FROM public.nhan_vien nv
    WHERE nv.role = 'to_qltb'
      AND COALESCE(nv.current_don_vi, nv.don_vi) = p_don_vi
      AND public.web_push_recipient_is_eligible(nv.id, p_don_vi, NULL)
      AND (p_cursor IS NULL OR nv.id > p_cursor)
      AND (
        v_search IS NULL
        OR nv.username ILIKE '%' || v_search || '%' ESCAPE E'\\'
        OR nv.full_name ILIKE '%' || v_search || '%' ESCAPE E'\\'
      )
    ORDER BY nv.id
    LIMIT v_limit + 1
  ), page AS (
    SELECT id, username, full_name FROM ranked WHERE row_number <= v_limit
  )
  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'user_id', page.id::TEXT,
          'username', page.username,
          'full_name', page.full_name
        )
        ORDER BY page.id
      ),
      '[]'::JSONB
    ),
    (SELECT MAX(ranked.id) FROM ranked WHERE ranked.row_number = v_limit),
    EXISTS (SELECT 1 FROM ranked WHERE ranked.row_number > v_limit)
  INTO v_candidates, v_next_cursor, v_has_more
  FROM page;

  RETURN jsonb_build_object(
    'version', 1,
    'don_vi_id', p_don_vi::TEXT,
    'candidates', v_candidates,
    'next_cursor', CASE
      WHEN v_has_more THEN v_next_cursor::TEXT
      ELSE NULL
    END
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.web_push_recipient_candidates(BIGINT, TEXT, INTEGER, BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.web_push_recipient_candidates(BIGINT, TEXT, INTEGER, BIGINT)
  TO authenticated;

-- The old two-argument entrypoint remains a compatibility wrapper. It cannot
-- change protected provenance because it always means self_action=none.
CREATE OR REPLACE FUNCTION public.web_push_recipient_config_set(
  p_don_vi BIGINT,
  p_usernames TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  RETURN public.web_push_recipient_config_set(p_don_vi, p_usernames, 'none');
END;
$function$;

CREATE FUNCTION public.web_push_recipient_config_set(
  p_don_vi BIGINT,
  p_usernames TEXT[],
  p_self_action TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_caller_id BIGINT;
  v_caller_role TEXT;
  v_names TEXT[];
  v_ids BIGINT[];
  v_count INTEGER;
  v_protected_count INTEGER;
  v_protected_overlap INTEGER;
  v_existing_owner BIGINT;
  v_self_action TEXT := LOWER(BTRIM(COALESCE(p_self_action, 'none')));
BEGIN
  PERFORM public.web_push_config_authorize(p_don_vi);
  v_caller_id := public.web_push_session_user_id();

  IF v_self_action NOT IN ('none', 'add', 'remove') THEN
    RAISE EXCEPTION 'invalid_request' USING ERRCODE = '22023';
  END IF;

  IF p_usernames IS NULL
    OR COALESCE(array_ndims(p_usernames), 1) > 1
    OR octet_length(p_usernames::TEXT) > 8192
    OR array_position(p_usernames, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'invalid_recipients' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT LOWER(BTRIM(u))), '{}'::TEXT[])
  INTO v_names
  FROM unnest(p_usernames) AS u
  WHERE BTRIM(u) <> '';

  IF cardinality(v_names) > 100 THEN
    RAISE EXCEPTION 'invalid_recipients' USING ERRCODE = '22023';
  END IF;

  -- Serialize replacement and protected self ownership per target unit.
  PERFORM 1 FROM public.don_vi WHERE id = p_don_vi FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_self_action <> 'none' THEN
    SELECT nv.role
    INTO v_caller_role
    FROM public.nhan_vien nv
    WHERE nv.id = v_caller_id;
    IF v_caller_role NOT IN ('admin', 'global') THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;

    SELECT cfg.protected_by_user_id
    INTO v_existing_owner
    FROM public.web_push_recipient_configs cfg
    WHERE cfg.don_vi_id = p_don_vi AND cfg.user_id = v_caller_id
    FOR UPDATE;

    IF FOUND AND v_existing_owner IS NOT NULL
      AND v_existing_owner IS DISTINCT FROM v_caller_id THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;

    IF v_self_action = 'add' THEN
      INSERT INTO public.web_push_recipient_configs(
        don_vi_id,
        user_id,
        protected_by_user_id
      )
      VALUES (p_don_vi, v_caller_id, v_caller_id)
      ON CONFLICT (don_vi_id, user_id) DO UPDATE
      SET protected_by_user_id = EXCLUDED.protected_by_user_id
      WHERE public.web_push_recipient_configs.protected_by_user_id IS NULL
        OR public.web_push_recipient_configs.protected_by_user_id = v_caller_id;
    ELSE
      DELETE FROM public.web_push_recipient_configs
      WHERE don_vi_id = p_don_vi
        AND user_id = v_caller_id
        AND protected_by_user_id = v_caller_id;
    END IF;
  END IF;

  -- Normal membership is validated independently from protected provenance.
  SELECT COALESCE(array_agg(m.id), '{}'::BIGINT[]), COUNT(*)
  INTO v_ids, v_count
  FROM (
    SELECT MIN(nv.id) AS id
    FROM unnest(v_names) AS u(name)
    LEFT JOIN public.nhan_vien nv ON LOWER(nv.username) = u.name
    GROUP BY u.name
    HAVING COUNT(nv.id) = 1 AND octet_length(u.name) <= 256
  ) AS m
  WHERE public.web_push_recipient_is_eligible(m.id, p_don_vi, NULL);

  IF v_count <> cardinality(v_names) THEN
    RAISE EXCEPTION 'invalid_recipients' USING ERRCODE = '22023';
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO v_protected_count
  FROM public.web_push_recipient_configs cfg
  WHERE cfg.don_vi_id = p_don_vi
    AND cfg.protected_by_user_id IS NOT NULL;

  SELECT COUNT(*)::INTEGER
  INTO v_protected_overlap
  FROM public.web_push_recipient_configs cfg
  WHERE cfg.don_vi_id = p_don_vi
    AND cfg.protected_by_user_id IS NOT NULL
    AND cfg.user_id = ANY(v_ids);

  IF v_protected_count + v_count - v_protected_overlap > 100 THEN
    RAISE EXCEPTION 'invalid_recipients' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.web_push_recipient_configs
  WHERE don_vi_id = p_don_vi AND protected_by_user_id IS NULL;

  INSERT INTO public.web_push_recipient_configs(don_vi_id, user_id)
  SELECT p_don_vi, UNNEST(v_ids)
  ON CONFLICT (don_vi_id, user_id) DO NOTHING;

  RETURN public.web_push_recipient_config_get(p_don_vi);
END;
$function$;

REVOKE ALL ON FUNCTION public.web_push_recipient_config_get(BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.web_push_recipient_config_set(bigint,text[])
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.web_push_recipient_config_set(bigint,text[],text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.web_push_recipient_config_get(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.web_push_recipient_config_set(BIGINT, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.web_push_recipient_config_set(bigint,text[],text) TO authenticated;

COMMIT;
