-- Append newly created units to both Web Push canary allowlists atomically.
BEGIN;

CREATE OR REPLACE FUNCTION public.don_vi_create(
  p_code text,
  p_name text,
  p_active boolean DEFAULT true,
  p_membership_quota integer DEFAULT NULL,
  p_logo_url text DEFAULT NULL,
  p_google_drive_folder_url text DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  code text,
  name text,
  active boolean,
  membership_quota integer,
  logo_url text,
  google_drive_folder_url text,
  used_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_role text;
  v_new_id bigint;
BEGIN
  v_role := lower(coalesce(
    public._get_jwt_claim('app_role'),
    public._get_jwt_claim('role'),
    ''
  ));
  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;
  IF v_role <> 'global' THEN
    RAISE EXCEPTION 'Forbidden' USING HINT = 'global_only';
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Tên đơn vị không được trống' USING HINT = 'validation_error';
  END IF;
  IF p_code IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.don_vi AS dv
    WHERE dv.code = p_code
  ) THEN
    RAISE EXCEPTION 'Mã đơn vị đã tồn tại' USING HINT = 'code_unique';
  END IF;

  INSERT INTO public.don_vi (
    code,
    name,
    active,
    membership_quota,
    logo_url,
    google_drive_folder_url
  )
  VALUES (
    p_code,
    btrim(p_name),
    coalesce(p_active, true),
    p_membership_quota,
    p_logo_url,
    p_google_drive_folder_url
  )
  RETURNING public.don_vi.id INTO v_new_id;

  UPDATE public.web_push_runtime_controls AS c
  SET registration_canary_don_vi_ids = array_append(c.registration_canary_don_vi_ids, v_new_id),
      dispatch_canary_don_vi_ids = array_append(c.dispatch_canary_don_vi_ids, v_new_id)
  WHERE c.singleton;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Web Push runtime controls missing' USING ERRCODE = '55000';
  END IF;

  RETURN QUERY
  SELECT d.id,
         d.code,
         d.name,
         d.active,
         d.membership_quota,
         d.logo_url,
         d.google_drive_folder_url,
         d.used_count
  FROM public.don_vi_get(v_new_id) AS d;
END;
$$;

REVOKE ALL ON FUNCTION public.don_vi_create(text, text, boolean, integer, text, text)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.don_vi_create(text, text, boolean, integer, text, text)
TO authenticated;

COMMIT;
