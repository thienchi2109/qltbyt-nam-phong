-- Migration: Add google_drive_folder_url to don_vi table
-- Purpose: Store per-tenant Google Drive shared folder URL for equipment attachments
-- Date: 2025-09-30

-- Add column to store Google Drive shared folder URL for each tenant
ALTER TABLE public.don_vi 
ADD COLUMN IF NOT EXISTS google_drive_folder_url TEXT;

COMMENT ON COLUMN public.don_vi.google_drive_folder_url IS 'URL của thư mục Google Drive chia sẻ cho file đính kèm thiết bị của đơn vị này';

-- Drop old don_vi_update function to avoid signature conflicts
DROP FUNCTION IF EXISTS public.don_vi_update(bigint, text, text, boolean, integer, text, boolean, boolean);

-- Create updated don_vi_update function with google_drive_folder_url support
CREATE OR REPLACE FUNCTION public.don_vi_update(
  p_id bigint,
  p_code text DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_active boolean DEFAULT NULL,
  p_membership_quota integer DEFAULT NULL,
  p_logo_url text DEFAULT NULL,
  p_google_drive_folder_url text DEFAULT NULL,
  p_set_membership_quota boolean DEFAULT false,
  p_set_logo_url boolean DEFAULT false,
  p_set_google_drive_folder_url boolean DEFAULT false
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
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE 
  v_role text; 
  v_existing public.don_vi%ROWTYPE;
BEGIN
  v_role := lower(coalesce(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  IF v_role = 'admin' THEN v_role := 'global'; END IF;
  IF v_role <> 'global' THEN
    RAISE EXCEPTION 'Forbidden' USING HINT = 'global_only';
  END IF;

  SELECT d.* INTO v_existing FROM public.don_vi d WHERE d.id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Đơn vị không tồn tại' USING HINT = 'not_found';
  END IF;

  IF p_code IS NOT NULL AND p_code <> v_existing.code AND EXISTS(SELECT 1 FROM public.don_vi dv WHERE dv.code = p_code AND dv.id <> p_id) THEN
    RAISE EXCEPTION 'Mã đơn vị đã tồn tại' USING HINT = 'code_unique';
  END IF;

  UPDATE public.don_vi AS dv SET
    code = COALESCE(p_code, dv.code),
    name = COALESCE(NULLIF(btrim(p_name),''), dv.name),
    active = COALESCE(p_active, dv.active),
    membership_quota = CASE WHEN p_set_membership_quota THEN p_membership_quota ELSE dv.membership_quota END,
    logo_url = CASE WHEN p_set_logo_url THEN p_logo_url ELSE dv.logo_url END,
    google_drive_folder_url = CASE WHEN p_set_google_drive_folder_url THEN p_google_drive_folder_url ELSE dv.google_drive_folder_url END
  WHERE dv.id = p_id;

  RETURN QUERY SELECT * FROM public.don_vi_get(p_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.don_vi_update(bigint, text, text, boolean, integer, text, text, boolean, boolean, boolean) TO authenticated;

-- Update don_vi_get to return google_drive_folder_url
DROP FUNCTION IF EXISTS public.don_vi_get(bigint);

CREATE OR REPLACE FUNCTION public.don_vi_get(
  p_id bigint
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
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_role text;
BEGIN
  v_role := lower(coalesce(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  IF v_role = 'admin' THEN v_role := 'global'; END IF;
  IF v_role <> 'global' THEN
    RAISE EXCEPTION 'Forbidden' USING HINT = 'global_only';
  END IF;

  RETURN QUERY
  SELECT d.id, d.code, d.name, d.active, d.membership_quota, d.logo_url, d.google_drive_folder_url, COALESCE(m.used_count,0) AS used_count
  FROM public.don_vi d
  LEFT JOIN (
    SELECT don_vi, COUNT(*)::int AS used_count
    FROM public.user_don_vi_memberships
    GROUP BY don_vi
  ) m ON m.don_vi = d.id
  WHERE d.id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.don_vi_get(bigint) TO authenticated;

-- Update don_vi_create to support google_drive_folder_url
DROP FUNCTION IF EXISTS public.don_vi_create(text, text, boolean, integer, text);

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
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_role text; v_new_id bigint;
BEGIN
  v_role := lower(coalesce(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  IF v_role = 'admin' THEN v_role := 'global'; END IF;
  IF v_role <> 'global' THEN
    RAISE EXCEPTION 'Forbidden' USING HINT = 'global_only';
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Tên đơn vị không được trống' USING HINT = 'validation_error';
  END IF;
  IF p_code IS NOT NULL AND EXISTS(SELECT 1 FROM public.don_vi dv WHERE dv.code = p_code) THEN
    RAISE EXCEPTION 'Mã đơn vị đã tồn tại' USING HINT = 'code_unique';
  END IF;

  INSERT INTO public.don_vi(code, name, active, membership_quota, logo_url, google_drive_folder_url)
  VALUES (p_code, btrim(p_name), coalesce(p_active,true), p_membership_quota, p_logo_url, p_google_drive_folder_url)
  RETURNING public.don_vi.id INTO v_new_id;

  RETURN QUERY SELECT * FROM public.don_vi_get(v_new_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.don_vi_create(text, text, boolean, integer, text, text) TO authenticated;
