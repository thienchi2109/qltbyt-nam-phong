# Runbook: ZBS access token refresh lifecycle

Ap dung cho issue #646 va Zalo ZBS/OA dispatch qua `/api/cron/zbs-dispatch`.

## Nguyen tac

- Khong dung `ZALO_ZBS_ACCESS_TOKEN` lam source of truth trong production.
- Access token ngan han va duoc refresh tu refresh token truoc khi gui live ZBS.
- Token state duoc luu server-only trong `public.zbs_oauth_token_state`.
- Client roles `anon` va `authenticated` khong co quyen doc/ghi token state.
- Khong log access token, refresh token, app secret, hoac provider payload co token.
- Giu `ZALO_ZBS_DISPATCH_ENABLED=false` cho den khi co lenh smoke live co kiem soat.

## Vercel env

Can co:

```text
ZALO_ZBS_APP_ID
ZALO_ZBS_APP_SECRET
ZALO_ZBS_INITIAL_REFRESH_TOKEN
ZALO_ZBS_REPAIR_TEMPLATE_ID
ZBS_INTERNAL_RPC_SECRET
ZALO_ZBS_DISPATCH_ENABLED=false
```

Khong can dung nua:

```text
ZALO_ZBS_ACCESS_TOKEN
```

Co the de bien cu ton tai tam thoi trong Vercel, nhung code khong doc bien nay nua.
Nen xoa sau khi deploy moi da on dinh de tranh operator hieu nham.

## Cach lay refresh token ban dau

Dung tai lieu Zalo:

- Lay Access Token: https://developers.zalo.me/docs/sdk/android-sdk/dang-nhap/lay-access-token
- Xac minh lai Refresh Token: https://developers.zalo.me/docs/sdk/android-sdk/dang-nhap/xac-minh-lai-refresh-token

Operator can lam tren app/tai khoan Zalo da duoc phe duyet dung cho ZBS/OA:

1. Dang nhap Zalo SDK theo app id dung moi truong production.
2. Lay access token va refresh token theo SDK docs.
3. Xac minh lai refresh token theo docs truoc khi dua vao Vercel.
4. Dat refresh token vao `ZALO_ZBS_INITIAL_REFRESH_TOKEN` trong Vercel.
5. Redeploy production.
6. Khong bat dispatch live ngay. Giu `ZALO_ZBS_DISPATCH_ENABLED=false`.

Neu da co token state hop le trong Supabase, bootstrap env chi dung cho recovery khi row token state trong DB chua co hoac mat refresh token.

## Runtime flow

1. Cron route xac thuc `CRON_SECRET`.
2. Dispatcher claim due outbox rows bang signed internal RPC.
3. Truoc khi gui Zalo, token manager goi `zbs_oauth_token_state_get`.
4. Neu access token con han va khong gan het han, dung token do.
5. Neu token thieu/het han/gan het han, goi Zalo OAuth endpoint bang app id, app secret, refresh token.
6. Neu Zalo tra token moi, persist bang `zbs_oauth_token_state_persist_success`.
7. Neu refresh fail, record sanitized error bang `zbs_oauth_token_state_record_error` va mark claimed outbox rows failed/retryable theo error classification.

## Monitoring

Kiem tra token state bang Supabase MCP, khong in token:

```sql
select
  provider,
  access_token_expires_at,
  refresh_token_issued_at,
  refresh_token_expires_at,
  last_refresh_at,
  last_refresh_error_code,
  last_refresh_error_message,
  last_refresh_error_at,
  updated_at
from public.zbs_oauth_token_state
where provider = 'zalo_zbs';
```

Kiem tra outbox loi lien quan token:

```sql
select
  id,
  source_id,
  status,
  attempt_count,
  last_error_code,
  last_error_message,
  updated_at
from public.zbs_notification_outbox
where provider = 'zalo_zbs'
  and last_error_code like 'zalo_token_%'
order by updated_at desc
limit 20;
```

## Recovery

Neu `last_refresh_error_code` la `zalo_token_refresh_failed` hoac provider bao refresh token invalid:

1. De `ZALO_ZBS_DISPATCH_ENABLED=false`.
2. Lay refresh token moi theo flow SDK docs.
3. Cap nhat `ZALO_ZBS_INITIAL_REFRESH_TOKEN` tren Vercel.
4. Neu DB token state dang giu refresh token hong, reset token state bang Supabase MCP sau khi user approve:

```sql
delete from public.zbs_oauth_token_state
where provider = 'zalo_zbs';
```

5. Redeploy production.
6. Chay mot dispatch smoke co kiem soat sau khi user xac nhan.

Khong retry artifact live cu neu chua quyet dinh ro reset row cu hay tao smoke request/outbox moi.
