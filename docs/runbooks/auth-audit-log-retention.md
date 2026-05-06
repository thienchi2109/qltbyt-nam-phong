# Auth audit log retention

## Chính sách

- Bảng áp dụng: `public.auth_audit_log`.
- Thời gian lưu giữ: 90 ngày.
- Cleanup: xóa cứng các dòng có `created_at < now() - interval '90 days'`.
- Không archive trước khi xóa.
- Không tạo meta-log table riêng cho cleanup. Kết quả cleanup được theo dõi qua response/log của Edge Function.

## Cách cleanup chạy

Cleanup gồm hai lớp:

1. `public.auth_audit_log_cleanup_scheduled()` trong Postgres.
   - Chỉ `service_role` được execute.
   - `SECURITY DEFINER`.
   - `SET search_path = public, pg_temp`.
   - Xóa theo batch để tránh một lệnh DELETE quá lớn.
   - Dùng advisory lock để tránh hai job chạy song song.

2. Supabase Edge Function `auth-audit-cleanup`.
   - Chỉ nhận `POST`.
   - Yêu cầu header `Authorization: Bearer <CRON_SECRET>`.
   - Dùng `SUPABASE_SERVICE_ROLE_KEY` để gọi RPC cleanup.
   - Chỉ trả/log số liệu tổng hợp, không trả raw audit rows.

## Lịch chạy đề xuất

- Weekly Sunday 03:00 UTC.
- Nếu tốc độ tăng log cao hơn dự kiến, chuyển sang daily 03:00 UTC mà không cần đổi schema.

## Verification sau apply/deploy

Chạy qua Supabase MCP, không dùng Supabase CLI cho DB operations:

```sql
select count(*)::bigint as row_count,
       min(created_at) as oldest_created_at,
       max(created_at) as newest_created_at,
       pg_total_relation_size('public.auth_audit_log') as total_bytes
from public.auth_audit_log;
```

Kiểm tra function/grants:

```sql
select p.proname,
       p.prosecdef as security_definer,
       p.proconfig as config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'auth_audit_log_cleanup_scheduled';
```

Chạy smoke:

```text
supabase/tests/auth_audit_log_smoke.sql
supabase/tests/auth_audit_log_retention_smoke.sql
```

Sau đó chạy Supabase advisors:

```text
get_advisors(security)
get_advisors(performance)
```

## Rollback

Nếu cần tắt cleanup tự động, tắt schedule gọi Edge Function trước. Không drop RPC nếu đang cần điều tra.

Nếu cần rollback schema:

```sql
revoke all on function public.auth_audit_log_cleanup_scheduled() from public;
revoke all on function public.auth_audit_log_cleanup_scheduled() from anon;
revoke all on function public.auth_audit_log_cleanup_scheduled() from authenticated;
revoke all on function public.auth_audit_log_cleanup_scheduled() from service_role;
drop function if exists public.auth_audit_log_cleanup_scheduled();
```

Không khôi phục được các dòng đã bị hard purge nếu không dùng bản backup DB.
