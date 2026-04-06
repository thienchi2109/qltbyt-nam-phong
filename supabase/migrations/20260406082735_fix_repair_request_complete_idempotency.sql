-- Fix: Add idempotency guard to repair_request_complete
-- Prevents duplicate audit logs and history entries when called on
-- an already-completed request (terminal states: 'Hoàn thành', 'Không HT').
-- Mirrors the guard already applied to transfer_request_complete in
-- migration 20260406054000_fix_transfer_request_complete_idempotency.sql.

BEGIN;

CREATE OR REPLACE FUNCTION public.repair_request_complete(
  p_id integer,
  p_completion text,
  p_reason text
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
  v_status text;
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

  -- Idempotency guard: reject if already in terminal state
  IF v_locked.trang_thai IN ('Hoàn thành', 'Không HT') THEN
    RAISE EXCEPTION 'Không thể hoàn thành lại yêu cầu đã hoàn thành' USING errcode = '22023';
  END IF;

  IF p_completion IS NOT NULL THEN
    v_status := 'Hoàn thành';
  ELSE
    v_status := 'Không HT';
  END IF;

  UPDATE public.yeu_cau_sua_chua
  SET trang_thai = v_status,
      ngay_hoan_thanh = now(),
      ket_qua_sua_chua = CASE WHEN v_status = 'Hoàn thành' THEN p_completion ELSE NULL END,
      ly_do_khong_hoan_thanh = CASE WHEN v_status <> 'Hoàn thành' THEN p_reason ELSE NULL END
  WHERE id = p_id
  RETURNING * INTO v_req;

  IF v_status = 'Hoàn thành' THEN
    UPDATE public.thiet_bi
    SET tinh_trang_hien_tai = 'Hoạt động'
    WHERE id = v_req.thiet_bi_id
      AND is_deleted = false;
  END IF;

  INSERT INTO public.lich_su_thiet_bi(thiet_bi_id, loai_su_kien, mo_ta, chi_tiet, yeu_cau_id)
  VALUES (
    v_req.thiet_bi_id,
    'Sửa chữa',
    'Yêu cầu sửa chữa cập nhật trạng thái',
    jsonb_build_object(
      'ket_qua', coalesce(v_req.ket_qua_sua_chua, v_req.ly_do_khong_hoan_thanh),
      'trang_thai', v_req.trang_thai
    ),
    p_id
  );

  IF NOT public.audit_log(
    'repair_request_complete',
    'repair_request',
    p_id,
    NULL,
    jsonb_build_object(
      'trang_thai', v_req.trang_thai,
      'ket_qua_sua_chua', v_req.ket_qua_sua_chua,
      'ly_do_khong_hoan_thanh', v_req.ly_do_khong_hoan_thanh
    )
  ) THEN
    RAISE EXCEPTION 'audit_log failed for repair_request %', p_id;
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.repair_request_complete(integer, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.repair_request_complete(integer, text, text) FROM PUBLIC;

COMMIT;
