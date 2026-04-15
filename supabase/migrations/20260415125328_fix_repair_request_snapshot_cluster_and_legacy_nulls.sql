-- Follow-up to 20260415113000_repair_request_equipment_status_invariant.sql.
-- Forward-only migration: do not roll back by editing/deleting applied history.
-- If rollback is ever required before first production write of this follow-up,
-- restore RPC bodies from 20260415113000_repair_request_equipment_status_invariant.sql.

BEGIN;

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
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_id integer;
  v_claims jsonb;
  v_role text;
  v_is_global boolean := false;
  v_user_id bigint;
  v_don_vi bigint;
  v_tb record;
  v_snapshot_status text;
BEGIN
  v_claims := coalesce(current_setting('request.jwt.claims', true), '{}'::text)::jsonb;
  v_role := lower(coalesce(nullif(v_claims->>'app_role', ''), nullif(v_claims->>'role', '')));
  v_is_global := v_role in ('global', 'admin');
  v_user_id := nullif(v_claims->>'user_id', '')::bigint;
  v_don_vi := nullif(v_claims->>'don_vi', '')::bigint;

  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim in JWT' USING errcode = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim in JWT' USING errcode = '42501';
  END IF;

  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Permission denied' USING errcode = '42501';
  END IF;

  IF NOT v_is_global AND v_don_vi IS NULL THEN
    RAISE EXCEPTION 'Missing don_vi claim for non-global role %', v_role USING errcode = '42501';
  END IF;

  SELECT tb.id, tb.don_vi, tb.tinh_trang_hien_tai
  INTO v_tb
  FROM public.thiet_bi tb
  WHERE tb.id = p_thiet_bi_id
    AND tb.is_deleted = false
  FOR UPDATE OF tb;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Thiết bị không tồn tại' USING errcode = 'P0002';
  END IF;

  IF NOT v_is_global AND v_tb.don_vi IS DISTINCT FROM v_don_vi THEN
    RAISE EXCEPTION 'Không có quyền trên thiết bị thuộc đơn vị khác' USING errcode = '42501';
  END IF;

  v_snapshot_status := v_tb.tinh_trang_hien_tai;

  IF v_tb.tinh_trang_hien_tai = 'Chờ sửa chữa' THEN
    -- Only inherit from the currently open repair cluster. Historical completed
    -- requests must not leak their old baseline into a newer cluster.
    SELECT ycss.tinh_trang_thiet_bi_truoc_yeu_cau
    INTO v_snapshot_status
    FROM public.yeu_cau_sua_chua ycss
    WHERE ycss.thiet_bi_id = p_thiet_bi_id
      AND ycss.trang_thai IN ('Chờ xử lý', 'Đã duyệt')
      AND ycss.tinh_trang_thiet_bi_truoc_yeu_cau IS NOT NULL
      AND ycss.tinh_trang_thiet_bi_truoc_yeu_cau <> 'Chờ sửa chữa'
    ORDER BY ycss.id DESC
    LIMIT 1;

    v_snapshot_status := coalesce(v_snapshot_status, v_tb.tinh_trang_hien_tai);
  END IF;

  INSERT INTO public.yeu_cau_sua_chua(
    thiet_bi_id,
    mo_ta_su_co,
    hang_muc_sua_chua,
    ngay_mong_muon_hoan_thanh,
    nguoi_yeu_cau,
    trang_thai,
    don_vi_thuc_hien,
    ten_don_vi_thue,
    tinh_trang_thiet_bi_truoc_yeu_cau
  )
  VALUES (
    p_thiet_bi_id,
    p_mo_ta_su_co,
    p_hang_muc_sua_chua,
    p_ngay_mong_muon_hoan_thanh,
    p_nguoi_yeu_cau,
    'Chờ xử lý',
    p_don_vi_thuc_hien,
    p_ten_don_vi_thue,
    v_snapshot_status
  )
  RETURNING id INTO v_id;

  PERFORM public.repair_request_sync_equipment_status(p_thiet_bi_id::bigint);

  INSERT INTO public.lich_su_thiet_bi(thiet_bi_id, loai_su_kien, mo_ta, chi_tiet, yeu_cau_id)
  VALUES (
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

  IF NOT public.audit_log(
    'repair_request_create',
    'repair_request',
    v_id,
    NULL,
    jsonb_build_object(
      'thiet_bi_id', p_thiet_bi_id,
      'mo_ta_su_co', p_mo_ta_su_co
    )
  ) THEN
    RAISE EXCEPTION 'audit_log failed for repair_request %', v_id;
  END IF;

  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.repair_request_create(integer, text, text, date, text, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.repair_request_create(integer, text, text, date, text, text, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.repair_request_delete(p_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_claims jsonb;
  v_role text;
  v_is_global boolean := false;
  v_user_id bigint;
  v_don_vi bigint;
  v_locked record;
  v_fallback_status text;
BEGIN
  v_claims := coalesce(current_setting('request.jwt.claims', true), '{}'::text)::jsonb;
  v_role := lower(coalesce(nullif(v_claims->>'app_role', ''), nullif(v_claims->>'role', '')));
  v_is_global := v_role in ('global', 'admin');
  v_user_id := nullif(v_claims->>'user_id', '')::bigint;
  v_don_vi := nullif(v_claims->>'don_vi', '')::bigint;

  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim in JWT' USING errcode = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim in JWT' USING errcode = '42501';
  END IF;

  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Permission denied' USING errcode = '42501';
  END IF;

  IF NOT v_is_global AND v_don_vi IS NULL THEN
    RAISE EXCEPTION 'Missing don_vi claim for non-global role %', v_role USING errcode = '42501';
  END IF;

  -- Intentionally allow delete cleanup even after equipment soft-delete.
  -- Other repair RPCs block deleted equipment because they mutate active workflow state.
  SELECT ycss.*, tb.don_vi AS tb_don_vi, tb.tinh_trang_hien_tai AS tb_tinh_trang_hien_tai
  INTO v_locked
  FROM public.yeu_cau_sua_chua ycss
  JOIN public.thiet_bi tb ON tb.id = ycss.thiet_bi_id
  WHERE ycss.id = p_id
  FOR UPDATE OF ycss, tb;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF NOT v_is_global AND v_locked.tb_don_vi IS DISTINCT FROM v_don_vi THEN
    RAISE EXCEPTION 'Không có quyền trên thiết bị thuộc đơn vị khác' USING errcode = '42501';
  END IF;

  -- Legacy rows created before the snapshot column existed can only be repaired
  -- best-effort here. Never feed a phantom Chờ sửa chữa status back into the
  -- sync helper when the deleted row is the last surviving repair request.
  v_fallback_status := coalesce(
    v_locked.tinh_trang_thiet_bi_truoc_yeu_cau,
    nullif(v_locked.tb_tinh_trang_hien_tai, 'Chờ sửa chữa'),
    'Hoạt động'
  );

  IF NOT public.audit_log(
    'repair_request_delete',
    'repair_request',
    p_id,
    NULL,
    jsonb_build_object(
      'thiet_bi_id', v_locked.thiet_bi_id,
      'trang_thai', v_locked.trang_thai
    )
  ) THEN
    RAISE EXCEPTION 'audit_log failed for repair_request %', p_id;
  END IF;

  DELETE FROM public.yeu_cau_sua_chua
  WHERE id = p_id;

  PERFORM public.repair_request_sync_equipment_status(v_locked.thiet_bi_id, v_fallback_status);

  INSERT INTO public.lich_su_thiet_bi(thiet_bi_id, loai_su_kien, mo_ta, chi_tiet)
  VALUES (
    v_locked.thiet_bi_id,
    'Sửa chữa',
    'Xóa yêu cầu sửa chữa',
    jsonb_build_object('yeu_cau_id', p_id)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.repair_request_delete(integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.repair_request_delete(integer) FROM PUBLIC;

UPDATE public.yeu_cau_sua_chua AS y
SET tinh_trang_thiet_bi_truoc_yeu_cau = coalesce(
  (
    SELECT y_open.tinh_trang_thiet_bi_truoc_yeu_cau
    FROM public.yeu_cau_sua_chua AS y_open
    WHERE y_open.thiet_bi_id = y.thiet_bi_id
      AND y_open.id <> y.id
      AND y_open.trang_thai IN ('Chờ xử lý', 'Đã duyệt')
      AND y_open.tinh_trang_thiet_bi_truoc_yeu_cau IS NOT NULL
      AND y_open.tinh_trang_thiet_bi_truoc_yeu_cau <> 'Chờ sửa chữa'
    ORDER BY y_open.id DESC
    LIMIT 1
  ),
  nullif(tb.tinh_trang_hien_tai, 'Chờ sửa chữa'),
  'Hoạt động'
)
FROM public.thiet_bi AS tb
WHERE y.thiet_bi_id = tb.id
  AND y.tinh_trang_thiet_bi_truoc_yeu_cau IS NULL;

COMMIT;
