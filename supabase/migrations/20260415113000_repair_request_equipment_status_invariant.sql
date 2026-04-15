-- Lock the repair-request equipment-status invariant so device status is derived
-- from the surviving repair requests instead of being updated ad hoc per RPC.
-- Prepared for review only; do not apply automatically from the agent session.
-- Rollback note: this forward-only migration adds a snapshot column and replaces
-- several RPC bodies. If rollback is required, restore those RPC bodies from the
-- immediately previous migrations before removing the snapshot column.

BEGIN;

ALTER TABLE public.yeu_cau_sua_chua
  ADD COLUMN IF NOT EXISTS tinh_trang_thiet_bi_truoc_yeu_cau text NULL;

COMMENT ON COLUMN public.yeu_cau_sua_chua.tinh_trang_thiet_bi_truoc_yeu_cau IS
  'Equipment status snapshot captured when the repair request was created; used to restore status when the request is deleted and no repair requests remain.';

CREATE OR REPLACE FUNCTION public.repair_request_sync_equipment_status(
  p_thiet_bi_id bigint,
  p_fallback_status text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_current_status text;
  v_is_deleted boolean := false;
  v_has_open_request boolean := false;
  v_latest_status text;
  v_next_status text;
BEGIN
  SELECT tb.tinh_trang_hien_tai, tb.is_deleted
  INTO v_current_status, v_is_deleted
  FROM public.thiet_bi tb
  WHERE tb.id = p_thiet_bi_id
  FOR UPDATE OF tb;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_is_deleted THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.yeu_cau_sua_chua ycss
    WHERE ycss.thiet_bi_id = p_thiet_bi_id
      AND ycss.trang_thai IN ('Chờ xử lý', 'Đã duyệt')
  )
  INTO v_has_open_request;

  IF v_has_open_request THEN
    v_next_status := 'Chờ sửa chữa';
  ELSE
    SELECT ycss.trang_thai
    INTO v_latest_status
    FROM public.yeu_cau_sua_chua ycss
    WHERE ycss.thiet_bi_id = p_thiet_bi_id
    ORDER BY ycss.id DESC
    LIMIT 1;

    IF FOUND THEN
      IF v_latest_status = 'Hoàn thành' THEN
        v_next_status := 'Hoạt động';
      ELSE
        v_next_status := 'Chờ sửa chữa';
      END IF;
    ELSE
      v_next_status := coalesce(p_fallback_status, v_current_status);
    END IF;
  END IF;

  IF v_next_status IS DISTINCT FROM v_current_status THEN
    UPDATE public.thiet_bi
    SET tinh_trang_hien_tai = v_next_status
    WHERE id = p_thiet_bi_id;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.repair_request_sync_equipment_status(bigint, text) FROM PUBLIC;

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
    SELECT ycss.tinh_trang_thiet_bi_truoc_yeu_cau
    INTO v_snapshot_status
    FROM public.yeu_cau_sua_chua ycss
    WHERE ycss.thiet_bi_id = p_thiet_bi_id
      AND ycss.tinh_trang_thiet_bi_truoc_yeu_cau IS NOT NULL
      AND ycss.tinh_trang_thiet_bi_truoc_yeu_cau <> 'Chờ sửa chữa'
    ORDER BY ycss.id ASC
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

CREATE OR REPLACE FUNCTION public.repair_request_approve(
  p_id integer,
  p_nguoi_duyet text,
  p_don_vi_thuc_hien text,
  p_ten_don_vi_thue text
)
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
  v_req public.yeu_cau_sua_chua%ROWTYPE;
  v_tb_don_vi bigint;
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

  SELECT ycss.*, tb.don_vi AS tb_don_vi
  INTO v_locked
  FROM public.yeu_cau_sua_chua ycss
  JOIN public.thiet_bi tb ON tb.id = ycss.thiet_bi_id
  WHERE ycss.id = p_id
    AND tb.is_deleted = false
  FOR UPDATE OF ycss, tb;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yêu cầu không tồn tại';
  END IF;

  v_tb_don_vi := v_locked.tb_don_vi;

  IF NOT v_is_global AND v_tb_don_vi IS DISTINCT FROM v_don_vi THEN
    RAISE EXCEPTION 'Không có quyền trên thiết bị thuộc đơn vị khác' USING errcode = '42501';
  END IF;

  IF v_locked.trang_thai IS DISTINCT FROM 'Chờ xử lý' THEN
    RAISE EXCEPTION 'Chỉ có thể duyệt yêu cầu ở trạng thái Chờ xử lý' USING errcode = '22023';
  END IF;

  UPDATE public.yeu_cau_sua_chua
  SET trang_thai = 'Đã duyệt',
      ngay_duyet = now(),
      nguoi_duyet = p_nguoi_duyet,
      don_vi_thuc_hien = p_don_vi_thuc_hien,
      ten_don_vi_thue = CASE
        WHEN p_don_vi_thuc_hien = 'thue_ngoai' THEN p_ten_don_vi_thue
        ELSE NULL
      END
  WHERE id = p_id
  RETURNING * INTO v_req;

  PERFORM public.repair_request_sync_equipment_status(v_req.thiet_bi_id);

  INSERT INTO public.lich_su_thiet_bi(thiet_bi_id, loai_su_kien, mo_ta, chi_tiet, yeu_cau_id)
  VALUES (
    v_req.thiet_bi_id,
    'Sửa chữa',
    'Duyệt yêu cầu sửa chữa',
    jsonb_build_object(
      'nguoi_duyet', v_req.nguoi_duyet,
      'ngay_duyet', v_req.ngay_duyet,
      'don_vi_thuc_hien', v_req.don_vi_thuc_hien,
      'ten_don_vi_thue', v_req.ten_don_vi_thue
    ),
    p_id
  );

  IF NOT public.audit_log(
    'repair_request_approve',
    'repair_request',
    p_id,
    NULL,
    jsonb_build_object(
      'trang_thai', v_req.trang_thai,
      'nguoi_duyet', v_req.nguoi_duyet,
      'ngay_duyet', v_req.ngay_duyet,
      'don_vi_thuc_hien', v_req.don_vi_thuc_hien,
      'ten_don_vi_thue', v_req.ten_don_vi_thue
    )
  ) THEN
    RAISE EXCEPTION 'audit_log failed for repair_request %', p_id;
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.repair_request_approve(integer, text, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.repair_request_approve(integer, text, text, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.repair_request_complete(
  p_id integer,
  p_completion text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_chi_phi_sua_chua numeric DEFAULT NULL
)
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
  v_thiet_bi_id bigint;
  v_tb_don_vi bigint;
  v_locked_status text;
  v_locked_completed_at timestamptz;
  v_status text;
  v_result text;
  v_reason text;
  v_cost numeric(14,2);
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

  SELECT ycss.thiet_bi_id, ycss.trang_thai, ycss.ngay_hoan_thanh, tb.don_vi
  INTO v_thiet_bi_id, v_locked_status, v_locked_completed_at, v_tb_don_vi
  FROM public.yeu_cau_sua_chua ycss
  JOIN public.thiet_bi tb ON tb.id = ycss.thiet_bi_id
  WHERE ycss.id = p_id
    AND tb.is_deleted = false
  FOR UPDATE OF ycss, tb;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yêu cầu không tồn tại';
  END IF;

  IF NOT v_is_global AND v_tb_don_vi IS DISTINCT FROM v_don_vi THEN
    RAISE EXCEPTION 'Không có quyền trên thiết bị thuộc đơn vị khác' USING errcode = '42501';
  END IF;

  IF v_locked_completed_at IS NOT NULL OR v_locked_status IN ('Hoàn thành', 'Không HT') THEN
    RAISE EXCEPTION 'Không thể hoàn thành lại yêu cầu đã hoàn thành' USING errcode = '22023';
  END IF;

  IF p_chi_phi_sua_chua IS NOT NULL AND p_chi_phi_sua_chua < 0 THEN
    RAISE EXCEPTION 'Chi phí sửa chữa không được âm' USING errcode = '22023';
  END IF;

  IF p_completion IS NOT NULL AND trim(p_completion) <> '' THEN
    v_status := 'Hoàn thành';
    v_result := p_completion;
    v_reason := NULL;
    v_cost := p_chi_phi_sua_chua;
  ELSE
    v_status := 'Không HT';
    v_result := NULL;
    v_reason := p_reason;
    v_cost := NULL;
  END IF;

  UPDATE public.yeu_cau_sua_chua
  SET trang_thai = v_status,
      ngay_hoan_thanh = now(),
      ket_qua_sua_chua = v_result,
      ly_do_khong_hoan_thanh = v_reason,
      chi_phi_sua_chua = v_cost
  WHERE id = p_id;

  PERFORM public.repair_request_sync_equipment_status(v_thiet_bi_id);

  INSERT INTO public.lich_su_thiet_bi(thiet_bi_id, loai_su_kien, mo_ta, chi_tiet, yeu_cau_id)
  VALUES (
    v_thiet_bi_id,
    'Sửa chữa',
    'Yêu cầu sửa chữa cập nhật trạng thái',
    jsonb_build_object(
      'ket_qua', coalesce(v_result, v_reason),
      'trang_thai', v_status,
      'chi_phi_sua_chua', v_cost
    ),
    p_id
  );

  IF NOT public.audit_log(
    'repair_request_complete',
    'repair_request',
    p_id,
    NULL,
    jsonb_build_object(
      'trang_thai', v_status,
      'ket_qua_sua_chua', v_result,
      'ly_do_khong_hoan_thanh', v_reason,
      'chi_phi_sua_chua', v_cost
    )
  ) THEN
    RAISE EXCEPTION 'audit_log failed for repair_request %', p_id;
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.repair_request_complete(integer, text, text, numeric) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.repair_request_complete(integer, text, text, numeric) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.repair_request_delete(
  p_id integer
)
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
  SELECT ycss.*, tb.don_vi AS tb_don_vi
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

  v_fallback_status := v_locked.tinh_trang_thiet_bi_truoc_yeu_cau;

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

DO $$
DECLARE
  v_thiet_bi_id bigint;
BEGIN
  -- Reconcile only the known-bad legacy class: equipment still stuck in
  -- Chờ sửa chữa even though the latest surviving repair request completed and
  -- there are no open repair requests left. Avoid broader rewrites because
  -- equipment status can also change through non-repair workflows.
  FOR v_thiet_bi_id IN
    SELECT tb.id
    FROM public.thiet_bi tb
    WHERE tb.is_deleted = false
      AND tb.tinh_trang_hien_tai = 'Chờ sửa chữa'
      AND NOT EXISTS (
        SELECT 1
        FROM public.yeu_cau_sua_chua y_open
        WHERE y_open.thiet_bi_id = tb.id
          AND y_open.trang_thai IN ('Chờ xử lý', 'Đã duyệt')
      )
      AND EXISTS (
        SELECT 1
        FROM public.yeu_cau_sua_chua y_latest
        WHERE y_latest.thiet_bi_id = tb.id
          AND y_latest.id = (
            SELECT max(y2.id)
            FROM public.yeu_cau_sua_chua y2
            WHERE y2.thiet_bi_id = tb.id
          )
          AND y_latest.trang_thai = 'Hoàn thành'
      )
  LOOP
    PERFORM public.repair_request_sync_equipment_status(v_thiet_bi_id, NULL);
  END LOOP;
END $$;

COMMIT;
