-- Fix don_vi_create function - resolve ambiguous "id" column reference
-- Error: column reference "id" is ambiguous - It could refer to either a PL/pgSQL variable or a table column

CREATE OR REPLACE FUNCTION public.don_vi_create(
  p_code text, 
  p_name text, 
  p_active boolean DEFAULT true, 
  p_membership_quota integer DEFAULT NULL::integer, 
  p_logo_url text DEFAULT NULL::text
)
RETURNS TABLE(
  id bigint, 
  code text, 
  name text, 
  active boolean, 
  membership_quota integer, 
  logo_url text, 
  used_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE 
  v_role text; 
  v_new_id bigint;
BEGIN
  -- Check user permissions
  v_role := lower(coalesce(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  IF v_role = 'admin' THEN v_role := 'global'; END IF;
  IF v_role <> 'global' THEN
    RAISE EXCEPTION 'Forbidden' USING HINT = 'global_only';
  END IF;

  -- Validate input
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Tên đơn vị không được trống' USING HINT = 'validation_error';
  END IF;
  
  IF p_code IS NOT NULL AND EXISTS(SELECT 1 FROM public.don_vi dv WHERE dv.code = p_code) THEN
    RAISE EXCEPTION 'Mã đơn vị đã tồn tại' USING HINT = 'code_unique';
  END IF;

  -- Insert new don_vi record with explicit table qualification
  INSERT INTO public.don_vi(code, name, active, membership_quota, logo_url)
  VALUES (p_code, btrim(p_name), coalesce(p_active, true), p_membership_quota, p_logo_url)
  RETURNING don_vi.id INTO v_new_id;

  -- Return the complete record using don_vi_get function
  -- Use explicit column aliasing to avoid ambiguity
  RETURN QUERY 
  SELECT 
    dv.id, 
    dv.code, 
    dv.name, 
    dv.active, 
    dv.membership_quota, 
    dv.logo_url, 
    dv.used_count 
  FROM public.don_vi_get(v_new_id) AS dv;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.don_vi_create TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.don_vi_create IS 'Creates a new don_vi (organizational unit) - fixed ambiguous id reference issue';