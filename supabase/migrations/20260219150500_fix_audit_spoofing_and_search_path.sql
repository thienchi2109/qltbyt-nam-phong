-- Migration: Fix audit log spoofing and missing SET search_path
-- Date: 2026-02-19
--
-- Fix 1: transfer_request_create — strip spoofable audit fields (created_by,
--         updated_by, nguoi_yeu_cau_id) from p_data before passing to audit_log.
--         The INSERT already uses server-enforced v_user_id, but the audit trail
--         still records the raw client-supplied values which can mislead auditors.
--
-- Fix 2: equipment_get — add SET search_path + admin → global mapping.
--         Missing search_path allows search-path injection on SECURITY DEFINER.
--         Missing admin mapping causes "access denied" for admin users.
--
-- Fix 3: equipment_get_by_code, departments_list, dashboard_equipment_total —
--         add SET search_path (same search-path injection risk).

BEGIN;

-- ============================================================================
-- Fix 1: transfer_request_create — strip audit fields from p_data in audit log
-- ============================================================================

CREATE OR REPLACE FUNCTION public.transfer_request_create(
  p_data jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_id int;
  v_claims jsonb;
  v_role text;
  v_is_global boolean := false;
  v_don_vi text;
  v_user_id int;
  v_tb record;
BEGIN
  v_claims := coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role := lower(coalesce(nullif(v_claims->>'app_role', ''), nullif(v_claims->>'role', '')));
  v_is_global := v_role in ('global', 'admin');
  v_don_vi := nullif(v_claims->>'don_vi', '');
  v_user_id := nullif(v_claims->>'user_id', '')::int;

  if v_role is null or v_role = '' then
    raise exception 'Missing role claim in JWT' using errcode = '42501';
  end if;

  if v_role = 'regional_leader' then
    raise exception 'Regional leaders have read-only access to transfers' using errcode = '42501';
  end if;

  select id, don_vi, khoa_phong_quan_ly
  into v_tb
  from public.thiet_bi
  where id = (p_data->>'thiet_bi_id')::int
    and is_deleted = false;

  if not found then
    raise exception 'Thiết bị không tồn tại' using errcode = 'P0002';
  end if;

  if not v_is_global and v_don_vi is not null and v_tb.don_vi::text is distinct from v_don_vi then
    raise exception 'Không có quyền trên thiết bị thuộc đơn vị khác';
  end if;

  insert into public.yeu_cau_luan_chuyen(
    thiet_bi_id,
    loai_hinh,
    ly_do_luan_chuyen,
    khoa_phong_hien_tai,
    khoa_phong_nhan,
    muc_dich,
    don_vi_nhan,
    dia_chi_don_vi,
    nguoi_lien_he,
    so_dien_thoai,
    ngay_du_kien_tra,
    nguoi_yeu_cau_id,
    trang_thai,
    created_by,
    updated_by
  )
  values (
    (p_data->>'thiet_bi_id')::int,
    p_data->>'loai_hinh',
    nullif(p_data->>'ly_do_luan_chuyen', ''),
    nullif(p_data->>'khoa_phong_hien_tai', ''),
    nullif(p_data->>'khoa_phong_nhan', ''),
    nullif(p_data->>'muc_dich', ''),
    nullif(p_data->>'don_vi_nhan', ''),
    nullif(p_data->>'dia_chi_don_vi', ''),
    nullif(p_data->>'nguoi_lien_he', ''),
    nullif(p_data->>'so_dien_thoai', ''),
    case
      when coalesce(p_data->>'ngay_du_kien_tra', '') <> '' then (p_data->>'ngay_du_kien_tra')::date
      else null
    end,
    v_user_id,   -- nguoi_yeu_cau_id (server-enforced)
    'cho_duyet',
    v_user_id,   -- created_by (server-enforced)
    v_user_id    -- updated_by (server-enforced)
  )
  returning id into v_id;

  -- FIX: strip spoofable audit fields from p_data before logging.
  -- The INSERT uses server-enforced v_user_id, but passing raw p_data to the
  -- audit log would still show client-supplied created_by/updated_by/nguoi_yeu_cau_id,
  -- misleading auditors about who performed the action.
  perform public.audit_log(
    'transfer_request_create',
    'transfer_request',
    v_id,
    null,
    p_data - 'created_by' - 'updated_by' - 'nguoi_yeu_cau_id'
  );

  return v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.transfer_request_create(jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.transfer_request_create(jsonb) FROM PUBLIC;

-- ============================================================================
-- Fix 2: equipment_get — add SET search_path + admin → global mapping
-- ============================================================================

CREATE OR REPLACE FUNCTION public.equipment_get(p_id bigint)
RETURNS thiet_bi
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  rec public.thiet_bi;
BEGIN
  -- FIX: map admin → global for consistency with equipment_get_by_code
  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  IF v_role = 'global' THEN
    SELECT * INTO rec
    FROM public.thiet_bi
    WHERE id = p_id
      AND is_deleted = false;
  ELSE
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RAISE EXCEPTION 'Equipment not found or access denied' USING ERRCODE = '42501';
    END IF;

    SELECT *
    INTO rec
    FROM public.thiet_bi
    WHERE id = p_id
      AND don_vi = ANY(v_allowed)
      AND is_deleted = false;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Equipment not found or access denied' USING ERRCODE = '42501';
  END IF;

  RETURN rec;
END;
$function$;

-- ============================================================================
-- Fix 3: equipment_get_by_code — add SET search_path
-- ============================================================================

CREATE OR REPLACE FUNCTION public.equipment_get_by_code(p_ma_thiet_bi text)
RETURNS thiet_bi
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := lower(coalesce(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  rec public.thiet_bi;
BEGIN
  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  IF p_ma_thiet_bi IS NULL OR trim(p_ma_thiet_bi) = '' THEN
    RAISE EXCEPTION 'ma_thiet_bi_required' USING ERRCODE = '22023';
  END IF;

  IF v_role = 'global' THEN
    SELECT *
      INTO rec
    FROM public.thiet_bi
    WHERE lower(ma_thiet_bi) = lower(p_ma_thiet_bi)
      AND is_deleted = false
    LIMIT 1;
  ELSE
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RAISE EXCEPTION 'Equipment not found or access denied' USING ERRCODE = '42501';
    END IF;

    SELECT *
      INTO rec
    FROM public.thiet_bi
    WHERE lower(ma_thiet_bi) = lower(p_ma_thiet_bi)
      AND don_vi = ANY(v_allowed)
      AND is_deleted = false
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Equipment not found or access denied' USING ERRCODE = '42501';
  END IF;

  RETURN rec;
END;
$function$;

-- ============================================================================
-- Fix 4: departments_list — add SET search_path
-- ============================================================================

CREATE OR REPLACE FUNCTION public.departments_list()
RETURNS TABLE(name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := '';
  v_claim_donvi BIGINT := NULL;
  v_effective_donvi BIGINT := NULL;
BEGIN
  v_role := COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), '');
  v_claim_donvi := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;

  IF lower(v_role) = 'global' THEN
    v_effective_donvi := NULL;
  ELSE
    v_effective_donvi := v_claim_donvi;
  END IF;

  RETURN QUERY
  SELECT DISTINCT coalesce(tb.khoa_phong_quan_ly, '') as name
  FROM public.thiet_bi tb
  WHERE coalesce(tb.khoa_phong_quan_ly, '') <> ''
    AND tb.is_deleted = false
    AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)
  ORDER BY 1;
END;
$function$;

-- ============================================================================
-- Fix 5: dashboard_equipment_total — add SET search_path
-- ============================================================================

CREATE OR REPLACE FUNCTION public.dashboard_equipment_total()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), '');
  v_allowed_don_vi BIGINT[];
  result INTEGER;
BEGIN
  v_allowed_don_vi := public.allowed_don_vi_for_session();

  SELECT COUNT(*)::INTEGER INTO result
  FROM public.thiet_bi tb
  WHERE tb.is_deleted = false
    AND (
      v_role = 'global'
      OR
      (v_allowed_don_vi IS NOT NULL AND array_length(v_allowed_don_vi, 1) > 0 AND tb.don_vi = ANY(v_allowed_don_vi))
    );

  RETURN COALESCE(result, 0);
END;
$function$;

COMMIT;
