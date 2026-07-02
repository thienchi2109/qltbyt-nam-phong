# ZBS Production Rollout Runbook

Audience: operator with Vercel, Zalo Business, and Supabase production access.

Goal: enable, observe, and roll back Zalo ZBS repair-request dispatch safely.

Scope: production operations for Issue #622. This runbook does not add schema,
change applied migrations, or enable dispatch by itself.

Related runbooks:

- `docs/runbooks/zbs-token-refresh-lifecycle.md`
- `docs/runbooks/zbs-delivery-webhook.md`
- `docs/runbooks/zbs-vm-dispatch-scheduler.md`

## 1. Production Enablement Decision

Production dispatch remains disabled until all checks below pass.

Decision for this repository change:

- Keep `ZALO_ZBS_DISPATCH_ENABLED=false` by default.
- Enable production dispatch only after a human operator confirms template
  approval, recipient setup, token refresh readiness, webhook callback setup,
  one controlled smoke test, and monitoring access.
- Roll back by setting `ZALO_ZBS_DISPATCH_ENABLED=false`. Preserve
  `zbs_notification_outbox` and `zbs_oauth_token_state` rows for audit and
  later recovery.

## 2. Required Env Vars And Secret Ownership

Configure these in Vercel Production unless noted otherwise:

```text
ZALO_ZBS_APP_ID
ZALO_ZBS_APP_SECRET
ZALO_ZBS_INITIAL_REFRESH_TOKEN
ZALO_ZBS_REPAIR_TEMPLATE_ID
ZALO_ZBS_DISPATCH_ENABLED=false
ZBS_INTERNAL_RPC_SECRET
CRON_SECRET
NEXT_PUBLIC_APP_URL
NEXTAUTH_URL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Configure these on the dispatch VM when using the VM scheduler:

```text
ZBS_DISPATCH_URL=https://www.cvmems.vn/api/cron/zbs-dispatch
CRON_SECRET=<same value as Vercel Production CRON_SECRET>
```

Ownership:

| Secret                           | Owner               | Notes                                                                 |
| -------------------------------- | ------------------- | --------------------------------------------------------------------- |
| `ZALO_ZBS_APP_ID`                | Zalo app owner      | Non-secret identifier, still keep in env.                             |
| `ZALO_ZBS_APP_SECRET`            | Zalo app owner      | Used for OAuth and `X-ZEvent-Signature` verification.                 |
| `ZALO_ZBS_INITIAL_REFRESH_TOKEN` | Zalo app owner      | Bootstrap only; runtime state is stored in `zbs_oauth_token_state`.   |
| `ZALO_ZBS_REPAIR_TEMPLATE_ID`    | Zalo template owner | Must match approved repair-request template fields.                   |
| `ZBS_INTERNAL_RPC_SECRET`        | App operator        | Signs internal cron-to-RPC proxy calls. Rotate with deploy.           |
| `CRON_SECRET`                    | App operator        | Authenticates `/api/cron/zbs-dispatch` and VM scheduler calls.        |
| `SUPABASE_SERVICE_ROLE_KEY`      | Database owner      | Server only. Never expose in client logs or runbooks with real value. |

Do not use `ZALO_ZBS_ACCESS_TOKEN` as the production source of truth. Static
access tokens expire and are not read by the production dispatcher.

## 3. Template, Recipient, And Phone Setup

1. Confirm the Zalo Business template is approved for service notification use.
2. Confirm the approved template fields match
   `ZALO_ZBS_REPAIR_TEMPLATE_ID` and the dispatcher payload.
3. Configure one recipient per row in `public.zbs_recipient_configs`.
4. Store recipient phone numbers as normalized digits, for example
   `84987654321`. Do not store comma-separated phone lists.
5. Keep recipient rows tenant-scoped by `don_vi_id` and `event_type`.
6. Use `event_type='repair_request_created'` for this rollout.

Check active recipients:

```sql
select
  cfg.don_vi_id,
  dv.ten_don_vi,
  cfg.event_type,
  cfg.recipient_phone,
  cfg.active,
  cfg.updated_at
from public.zbs_recipient_configs cfg
left join public.don_vi dv on dv.id = cfg.don_vi_id
where cfg.event_type = 'repair_request_created'
order by cfg.don_vi_id, cfg.recipient_phone;
```

## 4. Token Rotation

Runtime token state lives in `public.zbs_oauth_token_state`.

Normal rotation path:

1. Leave `ZALO_ZBS_DISPATCH_ENABLED=false`.
2. Put a fresh `ZALO_ZBS_INITIAL_REFRESH_TOKEN` in Vercel Production.
3. Redeploy production.
4. Run one guarded dispatch with a known outbox row or with no pending rows.
5. Confirm `last_refresh_at` is set and no plaintext token appears in logs.
6. Enable dispatch only after the smoke test and monitoring checks pass.

Inspect token state without printing token values:

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

If refresh fails:

1. Set `ZALO_ZBS_DISPATCH_ENABLED=false`.
2. Get a new refresh token through the approved Zalo flow.
3. Update `ZALO_ZBS_INITIAL_REFRESH_TOKEN`.
4. Reset token state only after human approval and only through Supabase MCP for
   agents:

```sql
delete from public.zbs_oauth_token_state
where provider = 'zalo_zbs';
```

5. Redeploy and run the smoke test again.

## 5. Webhook Secret Handling

Production callback URL:

```text
https://www.cvmems.vn/api/webhooks/zalo/zbs
```

The route validates `X-ZEvent-Signature` using `ZALO_ZBS_APP_SECRET` and rejects
requests outside the replay window. Do not create a separate webhook secret
unless the Zalo console is configured to sign with that separate value and the
application code is changed in a later issue.

Rotation path:

1. Set `ZALO_ZBS_DISPATCH_ENABLED=false`.
2. Rotate `ZALO_ZBS_APP_SECRET` in Zalo and Vercel as one maintenance action.
3. Redeploy production.
4. Send or replay a controlled delivery callback from Zalo tooling.
5. Confirm invalid signatures are rejected and valid callbacks update only the
   matching `tracking_id`.

## 6. Smoke Test

Run the smoke test with one controlled tenant and one test recipient.

1. Confirm `ZALO_ZBS_DISPATCH_ENABLED=false`.
2. Confirm the active recipient row exists for `repair_request_created`.
3. Create a repair request in the controlled tenant.
4. Confirm one outbox row is created:

```sql
select
  id,
  event_type,
  source_type,
  source_id,
  don_vi_id,
  recipient_phone,
  template_id,
  tracking_id,
  status,
  created_at
from public.zbs_notification_outbox
where provider = 'zalo_zbs'
order by created_at desc
limit 20;
```

5. Enable dispatch temporarily:

```text
ZALO_ZBS_DISPATCH_ENABLED=true
```

6. Trigger dispatch manually:

```bash
curl -fsS \
  -H "Authorization: Bearer $CRON_SECRET" \
  "https://www.cvmems.vn/api/cron/zbs-dispatch"
```

7. Confirm the smoke row becomes `sent`, then `delivered` after Zalo callback.
8. If anything fails, set `ZALO_ZBS_DISPATCH_ENABLED=false` before investigating.

## 7. Monitoring Queries

Run these from Supabase SQL editor or an approved operations shell. Agents must
use Supabase MCP for DB access.

Status overview:

```sql
select
  status,
  count(*) as total,
  min(created_at) as oldest_created_at,
  max(updated_at) as newest_updated_at
from public.zbs_notification_outbox
where provider = 'zalo_zbs'
group by status
order by status;
```

Pending rows due now:

```sql
select
  id,
  source_type,
  source_id,
  don_vi_id,
  recipient_phone,
  attempt_count,
  next_attempt_at,
  last_error_code,
  last_error_message,
  created_at
from public.zbs_notification_outbox
where provider = 'zalo_zbs'
  and status = 'pending'
  and next_attempt_at <= now()
order by next_attempt_at asc, created_at asc
limit 50;
```

Retryable rows are represented as `pending` rows with a previous error and a
future `next_attempt_at`:

```sql
select
  id,
  source_type,
  source_id,
  recipient_phone,
  attempt_count,
  next_attempt_at,
  now() - updated_at as age_since_retry_mark,
  last_error_code,
  last_error_message
from public.zbs_notification_outbox
where provider = 'zalo_zbs'
  and status = 'pending'
  and attempt_count between 1 and 2
  and next_attempt_at > now()
  and last_error_code is not null
order by next_attempt_at asc
limit 50;
```

Failed final rows:

```sql
select
  id,
  source_type,
  source_id,
  recipient_phone,
  attempt_count,
  last_error_code,
  last_error_message,
  provider_response,
  updated_at
from public.zbs_notification_outbox
where provider = 'zalo_zbs'
  and status = 'failed'
order by updated_at desc
limit 50;
```

Sent but not delivered:

```sql
select
  id,
  source_type,
  source_id,
  recipient_phone,
  tracking_id,
  provider_message_id,
  sent_at,
  now() - sent_at as sent_age
from public.zbs_notification_outbox
where provider = 'zalo_zbs'
  and status = 'sent'
order by sent_at asc
limit 50;
```

Delivered rows and webhook metadata:

```sql
select
  id,
  source_type,
  source_id,
  recipient_phone,
  tracking_id,
  provider_message_id,
  sent_at,
  delivered_at,
  delivery_webhook_received_at,
  provider_response->'delivery_webhook' as delivery_webhook
from public.zbs_notification_outbox
where provider = 'zalo_zbs'
  and status = 'delivered'
order by delivery_webhook_received_at desc nulls last, delivered_at desc
limit 50;
```

Token refresh state:

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

## 8. Rollback

Primary rollback:

```text
ZALO_ZBS_DISPATCH_ENABLED=false
```

Then redeploy production or update runtime env according to the hosting path.

Rollback expectations:

- New repair requests may continue to enqueue outbox rows.
- Dispatcher calls stop sending to Zalo while the gate is false.
- Existing `pending`, `sent`, `delivered`, and `failed` rows stay available for
  audit.
- Do not delete outbox rows during rollback unless the incident owner approves a
  data cleanup issue.
- Do not delete `zbs_oauth_token_state` unless token recovery explicitly
  requires it and the owner approves.

Secondary rollback for scheduler-only incidents:

1. Keep `ZALO_ZBS_DISPATCH_ENABLED=false`.
2. Stop the VM scheduler container:

```bash
cd /opt/qltbyt/zbs-dispatch-scheduler
sudo docker compose down
```

3. Leave Vercel env and DB state intact.

## 9. Phase 5 Closeout Checklist

- Required env vars and secret owners are documented.
- Token rotation and webhook secret handling are documented.
- Template approval, recipient setup, and phone normalization are documented.
- Smoke-test steps are documented.
- Monitoring queries cover `pending`, `sent`, `failed`, retryable, and
  `delivered` rows.
- Rollback preserves outbox rows and disables dispatch through
  `ZALO_ZBS_DISPATCH_ENABLED=false`.
- Production enablement decision is recorded above.
