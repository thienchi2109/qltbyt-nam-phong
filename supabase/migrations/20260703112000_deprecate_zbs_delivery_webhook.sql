BEGIN;

-- Zalo ZBS dispatch remains provider-success based. The provider delivery
-- webhook path is intentionally deprecated because production smoke testing
-- showed successful message receipt without any callback event from Zalo.
-- Rollback: recreate public.zbs_notification_outbox_mark_delivered from
-- supabase/migrations/20260702090000_add_zbs_delivery_webhook_rpc.sql if the
-- delivery webhook capability is intentionally restored in a future issue.
-- Do not inline the old function body here; keep the restoration source tied
-- to the migration that originally defined the RPC contract.
DROP FUNCTION IF EXISTS public.zbs_notification_outbox_mark_delivered(
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  jsonb
);

COMMIT;
