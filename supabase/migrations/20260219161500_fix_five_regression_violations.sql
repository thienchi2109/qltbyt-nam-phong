-- Migration: Fix five regression violations found in recent migrations
-- Date: 2026-02-19
--
-- Fix 1 (P1): equipment_list_for_reports — re-add _sanitize_ilike_pattern
--             that was dropped by 20260219151500 (ILIKE metacharacter injection)
--
-- Fix 2 (P2): equipment_restore — add defense-in-depth tenant filter in UPDATE
--             to match equipment_delete
--
-- Fix 3 (P1): repair_request_create — enforce don_vi claim for non-global users
--             to prevent tenant isolation bypass via NULL don_vi
--
-- Fix 4 (P2): departments_list — add admin → global mapping (missing)
--
-- Fix 5 (P1): dashboard_equipment_total — add lower() and admin → global mapping

BEGIN;

-- ============================================================================
-- Fix 1: equipment_list_for_reports — restore _sanitize_ilike_pattern
-- ============================================================================

CREATE OR REPLACE FUNCTION public.equipment_list_for_reports(
  p_q text DEFAULT NULL::text,
  p_sort text DEFAULT 'id.asc'::text,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 10000,
  p_don_vi bigint DEFAULT NULL::bigint,
  p_khoa_phong text DEFAULT NULL::text
)
RETURNS SETOF public.thiet_bi
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text;
  v_allowed bigint[];
  v_effective_donvi bigint;
  v_sort_col text;
  v_sort_dir text;
  v_offset int;
  v_limit int;
  v_sanitized_q TEXT;
BEGIN
  v_role := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed := public.allowed_don_vi_for_session_safe();

  IF v_role IN ('global', 'admin') THEN
    v_effective_donvi := p_don_vi;
  ELSIF v_role = 'regional_leader' THEN
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN;
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF p_don_vi = ANY(v_allowed) THEN
        v_effective_donvi := p_don_vi;
      ELSE
        RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING ERRCODE = '42501';
      END IF;
    ELSE
      v_effective_donvi := NULLIF(public._get_jwt_claim('don_vi'), '')::bigint;
      IF v_effective_donvi IS NULL THEN
        RETURN;
      END IF;
    END IF;
  ELSE
    v_effective_donvi := NULLIF(public._get_jwt_claim('don_vi'), '')::bigint;
    IF v_effective_donvi IS NULL THEN
      RAISE EXCEPTION 'Missing don_vi claim for role %', v_role USING ERRCODE = '42501';
    END IF;

    IF p_don_vi IS NOT NULL AND p_don_vi != v_effective_donvi THEN
      RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING ERRCODE = '42501';
    END IF;
  END IF;

  v_sort_col := split_part(p_sort, '.', 1);
  v_sort_dir := CASE lower(split_part(p_sort, '.', 2)) WHEN 'desc' THEN 'DESC' ELSE 'ASC' END;
  IF v_sort_col NOT IN ('id', 'ten_thiet_bi', 'ma_thiet_bi', 'khoa_phong_quan_ly', 'don_vi') THEN
    v_sort_col := 'id';
  END IF;

  -- FIX (from 151500): use guarded limit for both offset and LIMIT
  v_limit := GREATEST(COALESCE(p_page_size, 10000), 1);
  v_offset := GREATEST((p_page - 1), 0) * v_limit;

  -- FIX (from 023700): sanitize ILIKE metacharacters (%, _, \) before embedding in pattern.
  -- _sanitize_ilike_pattern returns NULL for NULL/empty input, so the
  -- $3 IS NULL guard in the query correctly skips the clause when p_q is absent.
  v_sanitized_q := public._sanitize_ilike_pattern(p_q);

  RETURN QUERY EXECUTE format(
    'SELECT * FROM public.thiet_bi
     WHERE is_deleted = false
       AND ($1::bigint IS NULL OR don_vi = $1)
       AND ($2::text IS NULL OR khoa_phong_quan_ly = $2)
       AND ($3::text IS NULL OR ten_thiet_bi ILIKE $5 OR ma_thiet_bi ILIKE $5)
     ORDER BY %I %s
     OFFSET $4 LIMIT $6',
    v_sort_col,
    v_sort_dir
  ) USING v_effective_donvi, p_khoa_phong, v_sanitized_q, v_offset, ('%' || COALESCE(v_sanitized_q, '') || '%'), v_limit;
END;
$function$;

-- ============================================================================
-- Fix 2: equipment_restore — add defense-in-depth tenant filter in UPDATE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.equipment_restore(p_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_code TEXT;
  v_name TEXT;
  v_row_don_vi BIGINT;
  v_is_deleted BOOLEAN;
  v_tenant_active BOOLEAN;
BEGIN
  -- Permission check: only global/to_qltb can restore (allow-list)
  IF v_role NOT IN ('global', 'to_qltb') THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  -- Atomic read with row lock
  SELECT tb.ma_thiet_bi, tb.ten_thiet_bi, tb.don_vi, tb.is_deleted
  INTO v_code, v_name, v_row_don_vi, v_is_deleted
  FROM public.thiet_bi tb
  WHERE tb.id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Equipment not found' USING ERRCODE = 'P0002';
  END IF;

  -- Tenant isolation check
  IF v_role <> 'global' AND v_row_don_vi IS DISTINCT FROM v_donvi THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  IF v_is_deleted IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Equipment not found or not deleted' USING ERRCODE = 'P0002';
  END IF;

  IF v_row_don_vi IS NULL THEN
    RAISE EXCEPTION 'Cannot restore equipment without tenant assignment'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT dv.active
  INTO v_tenant_active
  FROM public.don_vi dv
  WHERE dv.id = v_row_don_vi;

  IF NOT FOUND OR v_tenant_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Cannot restore equipment because tenant is missing or inactive'
      USING ERRCODE = 'P0001';
  END IF;

  -- FIX: add defense-in-depth tenant filter matching equipment_delete
  UPDATE public.thiet_bi
  SET is_deleted = false
  WHERE id = p_id
    AND is_deleted = true
    AND (v_role = 'global' OR don_vi = v_donvi);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Equipment not found or already restored'
      USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.audit_log(
    p_action_type := 'equipment_restore',
    p_entity_type := 'equipment',
    p_entity_id := p_id,
    p_entity_label := COALESCE(v_code, v_name, 'equipment-' || p_id::text),
    p_action_details := jsonb_build_object(
      'restored', true,
      'id', p_id,
      'ma_thiet_bi', v_code,
      'ten_thiet_bi', v_name,
      'don_vi', v_row_don_vi
    )
  );

  RETURN jsonb_build_object('success', true, 'id', p_id, 'restored', true);
END;
$function$;

-- ============================================================================
-- Fix 3: repair_request_create — enforce don_vi for non-global users
-- ============================================================================

CREATE OR REPLACE FUNCTION public.repair_request_create(
  p_thiet_bi_id integer,
  p_mo_ta_su_co text,
  p_hang_muc_sua_chua text,
  p_ngay_mong_muon_hoan_thanh date,
  p_nguoi_yeu_cau text,
  p_don_vi_thuc_hien text,
  p_ten_don_vi_thue text
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
  v_don_vi bigint;
  v_tb record;
BEGIN
  v_claims := coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role := lower(coalesce(nullif(v_claims->>'app_role', ''), nullif(v_claims->>'role', '')));
  v_is_global := v_role in ('global', 'admin');
  v_don_vi := nullif(v_claims->>'don_vi', '')::bigint;

  -- Role guard — without this, null role + null don_vi bypasses tenant isolation
  if v_role is null or v_role = '' then
    raise exception 'Missing role claim in JWT' using errcode = '42501';
  end if;

  -- FIX: non-global users MUST have a don_vi claim, otherwise
  -- the v_don_vi IS NOT NULL condition below silently skips tenant enforcement
  if not v_is_global and v_don_vi is null then
    raise exception 'Missing don_vi claim for non-global role %', v_role using errcode = '42501';
  end if;

  select id, don_vi, tinh_trang_hien_tai
  into v_tb
  from public.thiet_bi
  where id = p_thiet_bi_id
    and is_deleted = false;

  if not found then
    raise exception 'Thiết bị không tồn tại' using errcode = 'P0002';
  end if;

  if not v_is_global and v_don_vi is not null and v_tb.don_vi is distinct from v_don_vi then
    raise exception 'Không có quyền trên thiết bị thuộc đơn vị khác';
  end if;

  insert into public.yeu_cau_sua_chua(
    thiet_bi_id,
    mo_ta_su_co,
    hang_muc_sua_chua,
    ngay_mong_muon_hoan_thanh,
    nguoi_yeu_cau,
    trang_thai,
    don_vi_thuc_hien,
    ten_don_vi_thue
  )
  values (
    p_thiet_bi_id,
    p_mo_ta_su_co,
    p_hang_muc_sua_chua,
    p_ngay_mong_muon_hoan_thanh,
    p_nguoi_yeu_cau,
    'Chờ xử lý',
    p_don_vi_thuc_hien,
    p_ten_don_vi_thue
  )
  returning id into v_id;

  update public.thiet_bi
  set tinh_trang_hien_tai = 'Chờ sửa chữa'
  where id = p_thiet_bi_id
    and coalesce(tinh_trang_hien_tai, '') <> 'Chờ sửa chữa';

  insert into public.lich_su_thiet_bi(thiet_bi_id, loai_su_kien, mo_ta, chi_tiet, yeu_cau_id)
  values (
    p_thiet_bi_id,
    'Sửa chữa',
    'Tạo yêu cầu sửa chữa',
    jsonb_build_object(
      'mo_ta_su_co', p_mo_ta_su_co,
      'hang_muc', p_hang_muc_sua_chua,
      'ngay_mong_muon_hoan_thanh', p_ngay_mong_muon_hoan_thanh,
      'don_vi_thuc_hien', p_don_vi_thuc_hien,
      'ten_don_vi_thue', p_ten_don_vi_thue
    ),
    v_id
  );

  perform public.audit_log(
    'repair_request_create',
    'repair_request',
    v_id,
    null,
    jsonb_build_object('thiet_bi_id', p_thiet_bi_id, 'mo_ta_su_co', p_mo_ta_su_co)
  );

  return v_id;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.repair_request_create(integer, text, text, date, text, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.repair_request_create(integer, text, text, date, text, text, text) FROM PUBLIC;

-- ============================================================================
-- Fix 4: departments_list — add lower() and admin → global mapping
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
  v_role := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_claim_donvi := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;

  -- FIX: map admin → global for consistency with other functions
  IF v_role IN ('global', 'admin') THEN
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
-- Fix 5: dashboard_equipment_total — add lower() and admin → global mapping
-- ============================================================================

CREATE OR REPLACE FUNCTION public.dashboard_equipment_total()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  -- FIX: add lower() to normalize role
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed_don_vi BIGINT[];
  result INTEGER;
BEGIN
  -- FIX: map admin → global
  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

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
