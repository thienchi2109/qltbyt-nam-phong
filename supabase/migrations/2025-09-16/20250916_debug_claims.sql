-- Debug helper to inspect request JWT claims visible to PostgREST
create or replace function public.debug_claims()
returns jsonb
language sql
security definer
as $$
  select jsonb_build_object(
    'role', public._get_jwt_claim('role'),
    'app_role', public._get_jwt_claim('app_role'),
    'don_vi', public._get_jwt_claim('don_vi'),
    'user_id', public._get_jwt_claim('user_id')
  );
$$;

grant execute on function public.debug_claims() to authenticated;