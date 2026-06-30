-- Issue #618 follow-up: prevent legacy push trigger from running beside ZBS outbox.
--
-- The new repair_request_create path enqueues repair_request_created rows into
-- zbs_notification_outbox. The older AFTER INSERT trigger on yeu_cau_sua_chua
-- calls send-push-notification through pg_net for the same repair-created
-- event. Keep the legacy function available for audit/rollback context, but
-- remove the automatic trigger path so future ZBS dispatch is the single
-- repair-created outbound notification mechanism.

BEGIN;

DROP TRIGGER IF EXISTS on_repair_request_created ON public.yeu_cau_sua_chua;

COMMENT ON FUNCTION public.handle_new_repair_request_notification() IS
  'Deprecated legacy repair-created push path. Automatic trigger disabled by migration 20260630103000; ZBS notifications use public.zbs_notification_outbox.';

COMMIT;
