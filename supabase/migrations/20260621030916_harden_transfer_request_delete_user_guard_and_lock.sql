-- Harden transfer_request_delete user claim guard and row locking.

BEGIN;

CREATE OR REPLACE FUNCTION public.transfer_request_delete(
  p_id INTEGER
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims JSONB;
  v_role TEXT;
  v_user_id TEXT;
  v_don_vi TEXT;
  v_req RECORD;
BEGIN
  v_claims := COALESCE(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role := COALESCE(NULLIF(v_claims->>'app_role',''), NULLIF(v_claims->>'role',''));
  v_user_id := NULLIF(v_claims->>'user_id','');
  v_don_vi := NULLIF(v_claims->>'don_vi','');

  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim in JWT' USING ERRCODE = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim in JWT' USING ERRCODE = '42501';
  END IF;

  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Regional leaders have read-only access to transfers' USING ERRCODE = '42501';
  END IF;

  SELECT t.*, tb.don_vi AS tb_don_vi
  INTO v_req
  FROM public.yeu_cau_luan_chuyen t
  JOIN public.thiet_bi tb ON tb.id = t.thiet_bi_id
  WHERE t.id = p_id
  FOR UPDATE OF t, tb;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yêu cầu không tồn tại' USING ERRCODE = '42501';
  END IF;

  IF v_role IS DISTINCT FROM 'global'
    AND (v_don_vi IS NULL OR v_req.tb_don_vi::text IS DISTINCT FROM v_don_vi)
  THEN
    RAISE EXCEPTION 'Không có quyền xóa yêu cầu này' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.yeu_cau_luan_chuyen WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_request_delete(INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.transfer_request_delete(INTEGER) FROM PUBLIC;

COMMIT;
