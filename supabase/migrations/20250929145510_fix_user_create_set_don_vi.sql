-- Fix user_create function to also set don_vi field (not just current_don_vi)
-- The authenticate_user_dual_mode function may need both don_vi and current_don_vi to be set

CREATE OR REPLACE FUNCTION public.user_create(
  p_username text, 
  p_password text, 
  p_full_name text, 
  p_role text, 
  p_current_don_vi bigint, 
  p_memberships bigint[] DEFAULT NULL::bigint[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
declare
  v_claims jsonb; 
  v_app_role text; 
  v_req_don_vi bigint; 
  v_id int; 
  v_code text;
  v_hashed_password text;
begin
  -- Extract JWT claims for authorization
  v_claims := coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_app_role := coalesce(nullif(v_claims->>'app_role',''), nullif(v_claims->>'role',''));
  v_req_don_vi := nullif(v_claims->>'don_vi','')::bigint;

  -- Validate input parameters
  if p_username is null or trim(p_username) = '' or position(' ' in p_username) > 0 then
    raise exception 'Invalid username format';
  end if;
  if p_password is null or p_full_name is null or p_role is null or p_current_don_vi is null then
    raise exception 'Missing required fields';
  end if;

  -- Authorization: Only global can create across any tenants; non-global must create within their current tenant
  if v_app_role is distinct from 'global' then
    if v_req_don_vi is null or v_req_don_vi is distinct from p_current_don_vi then
      raise exception 'Không có quyền tạo người dùng ngoài đơn vị hiện tại';
    end if;
  end if;

  -- Hash the password using bcrypt (same as existing users)
  -- Use cost factor 12 (same as existing hashed passwords in the system)
  v_hashed_password := extensions.crypt(p_password, extensions.gen_salt('bf', 12));

  -- Insert new user with hashed password, set both don_vi and current_don_vi
  insert into public.nhan_vien(
    username, 
    password, 
    hashed_password,
    full_name, 
    role, 
    don_vi,           -- Set both don_vi and current_don_vi to same value
    current_don_vi
  )
  values (
    trim(p_username), 
    'hashed password', -- Set to standard placeholder like existing users
    v_hashed_password, -- Store the actual hashed password
    trim(p_full_name), 
    lower(p_role), 
    p_current_don_vi,  -- Set don_vi to the same as current_don_vi
    p_current_don_vi
  )
  returning id into v_id;

  -- Ensure membership includes current_don_vi
  insert into public.user_don_vi_memberships(user_id, don_vi)
  values (v_id, p_current_don_vi)
  on conflict do nothing;

  -- Optional additional memberships
  if p_memberships is not null then
    insert into public.user_don_vi_memberships(user_id, don_vi)
    select v_id, m
    from unnest(p_memberships) as m
    where m is not null and m <> p_current_don_vi
    on conflict do nothing;
  end if;

  return v_id;
end;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.user_create(text, text, text, text, bigint, bigint[]) TO authenticated;

-- Fix existing user that has don_vi NULL
UPDATE public.nhan_vien 
SET don_vi = current_don_vi 
WHERE current_don_vi IS NOT NULL 
AND don_vi IS NULL 
AND created_at > NOW() - INTERVAL '1 day';  -- Only fix recent users

-- Add comment for documentation
COMMENT ON FUNCTION public.user_create IS 'Creates a new user with properly hashed password and don_vi set - fixed authentication issue v2';