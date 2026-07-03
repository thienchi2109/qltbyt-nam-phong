BEGIN;

-- Zalo ZBS dispatch remains provider-success based. The provider delivery
-- webhook path is intentionally deprecated because production smoke testing
-- showed successful message receipt without any callback event from Zalo.
DROP FUNCTION IF EXISTS public.zbs_notification_outbox_mark_delivered(
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  jsonb
);

COMMIT;
