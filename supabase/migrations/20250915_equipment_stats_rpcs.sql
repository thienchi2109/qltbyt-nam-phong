-- Equipment statistics RPCs with tenant/role enforcement
-- Safe, idempotent additions

BEGIN;

-- Helper exists in prior migration; keep here for idempotency across environments
CREATE OR REPLACE FUNCTION public._get_jwt_claim(claim TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(current_setting('request.jwt.claims', true)::jsonb ->> claim, NULL);
$$;

-- Count equipment within tenant; optionally filter by statuses and query
CREATE OR REPLACE FUNCTION public.equipment_count(
  p_statuses TEXT[] DEFAULT NULL,
  p_q TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('role'), '');
  v_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_cnt BIGINT;
BEGIN
  IF v_role = 'global' THEN
    SELECT COUNT(*) INTO v_cnt
    FROM public.thiet_bi tb
    WHERE (p_q IS NULL OR tb.ten_thiet_bi ILIKE ('%' || p_q || '%') OR tb.ma_thiet_bi ILIKE ('%' || p_q || '%'))
      AND (p_statuses IS NULL OR tb.tinh_trang_hien_tai = ANY(p_statuses));
  ELSE
    SELECT COUNT(*) INTO v_cnt
    FROM public.thiet_bi tb
    WHERE tb.don_vi = v_donvi
      AND (p_q IS NULL OR tb.ten_thiet_bi ILIKE ('%' || p_q || '%') OR tb.ma_thiet_bi ILIKE ('%' || p_q || '%'))
      AND (p_statuses IS NULL OR tb.tinh_trang_hien_tai = ANY(p_statuses));
  END IF;
  RETURN COALESCE(v_cnt, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_count(TEXT[], TEXT) TO authenticated;

-- List equipment needing attention (maintenance/repair/calibration) within tenant
CREATE OR REPLACE FUNCTION public.equipment_attention_list(
  p_limit INT DEFAULT 5
)
RETURNS SETOF public.thiet_bi
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('role'), '');
  v_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
BEGIN
  IF v_role = 'global' THEN
    RETURN QUERY
    SELECT *
    FROM public.thiet_bi tb
    WHERE tb.tinh_trang_hien_tai IN ('Chờ sửa chữa', 'Chờ bảo trì', 'Chờ hiệu chuẩn/kiểm định')
    ORDER BY tb.ngay_bt_tiep_theo ASC NULLS LAST
    LIMIT GREATEST(p_limit, 1);
  ELSE
    RETURN QUERY
    SELECT *
    FROM public.thiet_bi tb
    WHERE tb.don_vi = v_donvi
      AND tb.tinh_trang_hien_tai IN ('Chờ sửa chữa', 'Chờ bảo trì', 'Chờ hiệu chuẩn/kiểm định')
    ORDER BY tb.ngay_bt_tiep_theo ASC NULLS LAST
    LIMIT GREATEST(p_limit, 1);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_attention_list(INT) TO authenticated;

COMMIT;
