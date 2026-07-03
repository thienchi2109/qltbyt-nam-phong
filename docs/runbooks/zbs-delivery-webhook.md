# Runbook: ZBS delivery webhook deprecated

ZBS delivery webhook is deprecated.

Production smoke testing on 2026-07-03 confirmed that Zalo accepted the message
and the recipient received it, but no delivery callback reached Vercel and
`delivery_webhook_received_at` stayed null. Operations should treat provider
Success from the send API as the terminal ZBS delivery signal.

Current behavior:

- ZBS dispatch still enqueues and sends repair-request notifications.
- `status='sent'`, `sent_at`, `provider_message_id`, and
  `provider_response.message = 'Success'` are the supported success fields.
- `delivered_at` and `delivery_webhook_received_at` are historical/unused fields.
- The delivery webhook runtime route and mark-delivered RPC are intentionally
  removed.

If Zalo later provides a reliable delivery event for this message type, restore
the capability through a new issue with fresh tests, a new endpoint contract,
and a new migration.
