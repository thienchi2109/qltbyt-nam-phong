-- Replace the repair-request history RPC's audit-log-backed timeline with
-- repair domain history from lich_su_thiet_bi so legacy requests still show
-- create/approve/complete milestones in the detail dialog History tab.
-- Forward-only migration: if the timeline contract needs to change again,
-- ship a new migration that replaces this function body instead of editing
-- applied history.

BEGIN;

CREATE OR REPLACE FUNCTION public.repair_request_change_history_list(p_repair_request_id INT)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_jwt_claims JSONB := COALESCE(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role TEXT;
  v_user_id TEXT;
  v_is_global BOOLEAN := FALSE;
  v_allowed BIGINT[] := NULL;
  v_request_don_vi BIGINT;
BEGIN
  IF p_repair_request_id IS NULL THEN
    RETURN;
  END IF;

  v_role := lower(COALESCE(
    NULLIF(v_jwt_claims->>'app_role', ''),
    NULLIF(v_jwt_claims->>'role', ''),
    ''
  ));
  v_user_id := NULLIF(COALESCE(v_jwt_claims->>'user_id', v_jwt_claims->>'sub'), '');

  IF v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;
  v_is_global := (v_role = 'global');

  SELECT tb.don_vi
  INTO v_request_don_vi
  FROM public.yeu_cau_sua_chua ycss
  JOIN public.thiet_bi tb ON tb.id = ycss.thiet_bi_id
  WHERE ycss.id = p_repair_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yêu cầu sửa chữa không tồn tại hoặc bạn không có quyền truy cập'
      USING ERRCODE = '42501';
  END IF;

  IF NOT v_is_global THEN
    v_allowed := public.allowed_don_vi_for_session();

    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RAISE EXCEPTION 'Yêu cầu sửa chữa không tồn tại hoặc bạn không có quyền truy cập'
        USING ERRCODE = '42501';
    END IF;

    IF v_request_don_vi IS NULL OR NOT (v_request_don_vi = ANY(v_allowed)) THEN
      RAISE EXCEPTION 'Yêu cầu sửa chữa không tồn tại hoặc bạn không có quyền truy cập'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN QUERY
  WITH request_context AS (
    SELECT
      ycss.nguoi_yeu_cau,
      ycss.nguoi_duyet,
      ycss.nguoi_xac_nhan
    FROM public.yeu_cau_sua_chua ycss
    WHERE ycss.id = p_repair_request_id
  ),
  domain_history AS (
    SELECT
      ls.id,
      ls.ngay_thuc_hien AS created_at,
      CASE ls.mo_ta
        WHEN 'Tạo yêu cầu sửa chữa' THEN 'repair_request_create'
        WHEN 'Cập nhật nội dung yêu cầu sửa chữa' THEN 'repair_request_update'
        WHEN 'Duyệt yêu cầu sửa chữa' THEN 'repair_request_approve'
        WHEN 'Yêu cầu sửa chữa cập nhật trạng thái' THEN 'repair_request_complete'
        WHEN 'Xóa yêu cầu sửa chữa' THEN 'repair_request_delete'
        ELSE NULL
      END AS action_type,
      CASE ls.mo_ta
        WHEN 'Tạo yêu cầu sửa chữa' THEN
          NULLIF(BTRIM(COALESCE(req.nguoi_yeu_cau, ls.chi_tiet->>'nguoi_yeu_cau')), '')
        WHEN 'Duyệt yêu cầu sửa chữa' THEN
          NULLIF(BTRIM(COALESCE(ls.chi_tiet->>'nguoi_duyet', req.nguoi_duyet)), '')
        WHEN 'Yêu cầu sửa chữa cập nhật trạng thái' THEN
          NULLIF(BTRIM(COALESCE(ls.chi_tiet->>'nguoi_xac_nhan', req.nguoi_xac_nhan)), '')
        ELSE NULL
      END AS admin_full_name,
      CASE ls.mo_ta
        WHEN 'Tạo yêu cầu sửa chữa' THEN
          jsonb_strip_nulls(
            (COALESCE(ls.chi_tiet, '{}'::jsonb) - 'hang_muc')
            || jsonb_build_object(
              'hang_muc_sua_chua', NULLIF(ls.chi_tiet->>'hang_muc', ''),
              'nguoi_yeu_cau', NULLIF(COALESCE(req.nguoi_yeu_cau, ls.chi_tiet->>'nguoi_yeu_cau'), ''),
              'trang_thai', 'Chờ xử lý'
            )
          )
        WHEN 'Cập nhật nội dung yêu cầu sửa chữa' THEN
          jsonb_strip_nulls(
            (COALESCE(ls.chi_tiet, '{}'::jsonb) - 'hang_muc')
            || jsonb_build_object(
              'hang_muc_sua_chua', NULLIF(ls.chi_tiet->>'hang_muc', '')
            )
          )
        WHEN 'Duyệt yêu cầu sửa chữa' THEN
          jsonb_strip_nulls(
            COALESCE(ls.chi_tiet, '{}'::jsonb)
            || jsonb_build_object(
              'nguoi_duyet', NULLIF(COALESCE(ls.chi_tiet->>'nguoi_duyet', req.nguoi_duyet), ''),
              'trang_thai', 'Đã duyệt'
            )
          )
        WHEN 'Yêu cầu sửa chữa cập nhật trạng thái' THEN
          CASE
            WHEN COALESCE(ls.chi_tiet->>'trang_thai', '') = 'Không HT' THEN
              jsonb_strip_nulls(
                (COALESCE(ls.chi_tiet, '{}'::jsonb) - 'ket_qua')
                || jsonb_build_object(
                  'ly_do_khong_hoan_thanh', NULLIF(ls.chi_tiet->>'ket_qua', '')
                )
              )
            ELSE
              jsonb_strip_nulls(
                (COALESCE(ls.chi_tiet, '{}'::jsonb) - 'ket_qua')
                || jsonb_build_object(
                  'ket_qua_sua_chua', NULLIF(ls.chi_tiet->>'ket_qua', '')
                )
              )
          END
        ELSE
          COALESCE(ls.chi_tiet, '{}'::jsonb)
      END AS action_details
    FROM public.lich_su_thiet_bi ls
    CROSS JOIN request_context req
    WHERE ls.yeu_cau_id = p_repair_request_id
      AND ls.loai_su_kien = 'Sửa chữa'
      AND ls.mo_ta IN (
        'Tạo yêu cầu sửa chữa',
        'Cập nhật nội dung yêu cầu sửa chữa',
        'Duyệt yêu cầu sửa chữa',
        'Yêu cầu sửa chữa cập nhật trạng thái',
        'Xóa yêu cầu sửa chữa'
      )
  )
  SELECT jsonb_build_object(
    'id', dh.id,
    'action_type', dh.action_type,
    'admin_username', 'system',
    'admin_full_name', dh.admin_full_name,
    'action_details', dh.action_details,
    'created_at', dh.created_at
  )
  FROM domain_history dh
  WHERE dh.action_type IS NOT NULL
  ORDER BY dh.created_at DESC, dh.id DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.repair_request_change_history_list(INT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.repair_request_change_history_list(INT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.repair_request_change_history_list(INT) FROM PUBLIC;

COMMENT ON FUNCTION public.repair_request_change_history_list(INT) IS
'Lists repair-request domain history from lich_su_thiet_bi with the same tenant access semantics as repair_request_get.';

NOTIFY pgrst, 'reload schema';

COMMIT;
