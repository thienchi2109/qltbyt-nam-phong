-- Issue #621 review follow-up: enforce the tracking_id uniqueness assumed by
-- ZBS delivery webhook matching. The initial Phase 4 migration added a
-- non-unique lookup index; this superseding migration keeps fresh DB order
-- deterministic and makes duplicate provider tracking ids fail closed.

BEGIN;

DROP INDEX IF EXISTS public.zbs_notification_outbox_tracking_id_idx;

CREATE UNIQUE INDEX IF NOT EXISTS zbs_notification_outbox_tracking_id_idx
  ON public.zbs_notification_outbox (tracking_id)
  WHERE provider = 'zalo_zbs';

COMMENT ON INDEX public.zbs_notification_outbox_tracking_id_idx IS
  'Unique ZBS delivery webhook lookup key. Prevents ambiguous delivery callbacks for reused tracking_id values.';

COMMIT;
