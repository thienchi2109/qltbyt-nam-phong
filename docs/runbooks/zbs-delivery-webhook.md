# Runbook: ZBS delivery webhook

Ap dung cho inbound Zalo ZBS delivery callback vao:

```text
https://www.cvmems.vn/api/webhooks/zalo/zbs
```

Webhook nay chi cap nhat delivery status cho outbox da gui. No khong enqueue va
khong gui thong bao moi.

## Required env

Production can co cac bien da dung cho ZBS dispatch:

```text
ZALO_ZBS_APP_ID
ZALO_ZBS_APP_SECRET
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

`ZALO_ZBS_APP_SECRET` la secret dung de validate `X-ZEvent-Signature`. Khong tao
secret rieng neu Zalo console dang ky callback bang cung OA/app secret.

## Zalo console setup

Trong Zalo/ZNS webhook configuration:

1. Dat callback URL thanh `https://www.cvmems.vn/api/webhooks/zalo/zbs`.
2. Bat event `user_received_message`.
3. Luu cau hinh va dung chinh `ZALO_ZBS_APP_ID` / `ZALO_ZBS_APP_SECRET` cua
   production.
4. Neu rotate app secret, cap nhat Vercel Production env truoc, redeploy, roi
   rotate trong Zalo console de tranh callback bi `401`.

Route validate raw body theo header `X-ZEvent-Signature` dang `mac=<sha256>`.
Signature hop le moi duoc parse thanh delivery mutation.

## Expected DB effect

Trusted event `event_name=user_received_message` phai co `message.tracking_id`.
Route goi service-role RPC:

```sql
public.zbs_notification_outbox_mark_delivered(
  p_tracking_id,
  p_provider_message_id,
  p_recipient_phone,
  p_delivered_at,
  p_delivery_webhook_received_at,
  p_delivery_webhook_payload
)
```

RPC chi match `public.zbs_notification_outbox` rows:

- `provider = 'zalo_zbs'`
- `tracking_id = p_tracking_id`
- `status in ('sent', 'delivered')`

Lan dau match row `sent` se chuyen sang `delivered`, set `delivered_at`, set
`delivery_webhook_received_at`, va luu metadata o
`provider_response.delivery_webhook`. Neu row da `delivered`, RPC tra row theo
tracking id nhung giu gia tri delivery hien co de duplicate callback idempotent.

## Monitoring

Theo doi sent vs delivered:

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

Kiem tra delivery webhook gan day:

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
  and delivery_webhook_received_at is not null
order by delivery_webhook_received_at desc
limit 20;
```

Kiem tra rows da sent nhung chua co delivery callback:

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

## Troubleshooting

- `401`: signature sai, sai app id/secret, body bi proxy rewrite, hoac header
  `X-ZEvent-Signature` thieu.
- `202`: event signed hop le nhung khong phai `user_received_message`; khong co
  DB mutation.
- `400`: delivery event trusted nhung payload thieu `message.tracking_id`.
- `500`: route config thieu hoac RPC loi. Kiem tra Vercel logs, khong expose DB
  error cho caller.

Dung Supabase MCP de inspect DB/RPC. Khong dung Supabase CLI cho live DB.
