-- Tenant and User Management RPCs (SECURITY DEFINER; no RLS; tenant checks in SQL)

-- 1) List active tenants for pickers
create or replace function public.tenant_list()
returns setof jsonb
language sql
security definer
as $$
  select jsonb_build_object(
    'id', d.id,
    'code', d.code,
    'name', d.name,
    'active', d.active
  )
  from public.don_vi d
  where coalesce(d.active, true) = true
  order by d.name;
$$;
grant execute on function public.tenant_list() to authenticated;

-- 2) Create user and set memberships/current tenant
create or replace function public.user_create(
  p_username text,
  p_password text,
  p_full_name text,
  p_role text,
  p_current_don_vi bigint,
  p_memberships bigint[] default null
) returns int
language plpgsql
security definer
as $$
declare
  v_claims jsonb; v_app_role text; v_req_don_vi bigint; v_id int; v_code text;
begin
  v_claims := coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_app_role := coalesce(nullif(v_claims->>'app_role',''), nullif(v_claims->>'role',''));
  v_req_don_vi := nullif(v_claims->>'don_vi','')::bigint;

  if p_username is null or trim(p_username) = '' or position(' ' in p_username) > 0 then
    raise exception 'Invalid username format';
  end if;
  if p_password is null or p_full_name is null or p_role is null or p_current_don_vi is null then
    raise exception 'Missing required fields';
  end if;

  -- Only global can create across any tenants; non-global must create within their current tenant
  if v_app_role is distinct from 'global' then
    if v_req_don_vi is null or v_req_don_vi is distinct from p_current_don_vi then
      raise exception 'Không có quyền tạo người dùng ngoài đơn vị hiện tại';
    end if;
  end if;

  insert into public.nhan_vien(username, password, full_name, role, current_don_vi)
  values (trim(p_username), p_password, trim(p_full_name), lower(p_role), p_current_don_vi)
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
grant execute on function public.user_create(text, text, text, text, bigint, bigint[]) to authenticated;

-- 3) Add membership
create or replace function public.user_membership_add(p_user_id int, p_don_vi bigint)
returns void
language plpgsql
security definer
as $$
declare v_app_role text; v_claims jsonb; v_req_don_vi bigint; v_target_don_vi bigint; begin
  v_claims := coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_app_role := coalesce(nullif(v_claims->>'app_role',''), nullif(v_claims->>'role',''));
  v_req_don_vi := nullif(v_claims->>'don_vi','')::bigint;
  v_target_don_vi := p_don_vi;
  if v_app_role is distinct from 'global' and (v_req_don_vi is null or v_req_don_vi is distinct from v_target_don_vi) then
    raise exception 'Không có quyền thêm thành viên ngoài đơn vị hiện tại';
  end if;
  insert into public.user_don_vi_memberships(user_id, don_vi)
  values (p_user_id, p_don_vi) on conflict do nothing;
end; $$;
grant execute on function public.user_membership_add(int, bigint) to authenticated;

-- 4) Remove membership
create or replace function public.user_membership_remove(p_user_id int, p_don_vi bigint)
returns void
language plpgsql
security definer
as $$
declare v_app_role text; v_claims jsonb; v_req_don_vi bigint; begin
  v_claims := coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_app_role := coalesce(nullif(v_claims->>'app_role',''), nullif(v_claims->>'role',''));
  v_req_don_vi := nullif(v_claims->>'don_vi','')::bigint;
  if v_app_role is distinct from 'global' and (v_req_don_vi is null or v_req_don_vi is distinct from p_don_vi) then
    raise exception 'Không có quyền xoá thành viên ngoài đơn vị hiện tại';
  end if;
  delete from public.user_don_vi_memberships where user_id = p_user_id and don_vi = p_don_vi;
end; $$;
grant execute on function public.user_membership_remove(int, bigint) to authenticated;

-- 5) Set current tenant for a user
create or replace function public.user_set_current_don_vi(p_user_id int, p_don_vi bigint)
returns void
language plpgsql
security definer
as $$
declare v_app_role text; v_claims jsonb; v_req_don_vi bigint; v_has_membership boolean; begin
  v_claims := coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_app_role := coalesce(nullif(v_claims->>'app_role',''), nullif(v_claims->>'role',''));
  v_req_don_vi := nullif(v_claims->>'don_vi','')::bigint;
  -- Non-global can only set current_don_vi to their own tenant
  if v_app_role is distinct from 'global' and (v_req_don_vi is null or v_req_don_vi is distinct from p_don_vi) then
    raise exception 'Không có quyền thay đổi đơn vị hiện tại ngoài phạm vi';
  end if;
  select exists(select 1 from public.user_don_vi_memberships where user_id = p_user_id and don_vi = p_don_vi) into v_has_membership;
  if not v_has_membership then
    raise exception 'Người dùng không thuộc đơn vị này';
  end if;
  update public.nhan_vien set current_don_vi = p_don_vi where id = p_user_id;
end; $$;
grant execute on function public.user_set_current_don_vi(int, bigint) to authenticated;
