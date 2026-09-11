-- Web Push Phase 2: isolated storage only; no repair-request enqueue entrypoint.
BEGIN;

CREATE TABLE public.web_push_recipient_configs (
  don_vi_id bigint NOT NULL REFERENCES public.don_vi(id) ON DELETE CASCADE,
  user_id bigint NOT NULL REFERENCES public.nhan_vien(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (don_vi_id, user_id)
);
CREATE INDEX web_push_recipient_configs_user_idx ON public.web_push_recipient_configs(user_id);

CREATE TABLE public.web_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id bigint REFERENCES public.nhan_vien(id) ON DELETE SET NULL,
  endpoint text NOT NULL UNIQUE CHECK (octet_length(endpoint) BETWEEN 1 AND 2048),
  p256dh text NOT NULL,
  auth text NOT NULL,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  vapid_key_version text NOT NULL CHECK (octet_length(vapid_key_version) BETWEEN 1 AND 128),
  authorization_epoch timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE INDEX web_push_subscriptions_owner_idx ON public.web_push_subscriptions(user_id);
CREATE INDEX web_push_subscriptions_retention_idx ON public.web_push_subscriptions(revoked_at)
  WHERE revoked_at IS NOT NULL;

CREATE TABLE public.web_push_notification_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type = 'repair_request_created'),
  request_id integer NOT NULL CHECK (request_id > 0),
  recipient_user_id bigint NOT NULL CHECK (recipient_user_id > 0),
  don_vi_id bigint NOT NULL CHECK (don_vi_id > 0),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object' AND octet_length(payload::text) <= 3072),
  created_at timestamptz NOT NULL DEFAULT now(),
  deadline timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  materialized_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','materialized','completed','cancelled','expired')),
  terminal_at timestamptz,
  accepted_count integer NOT NULL DEFAULT 0 CHECK (accepted_count >= 0),
  failed_count integer NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  cancelled_count integer NOT NULL DEFAULT 0 CHECK (cancelled_count >= 0),
  expired_count integer NOT NULL DEFAULT 0 CHECK (expired_count >= 0),
  UNIQUE (event_type, request_id, recipient_user_id),
  CHECK (deadline = created_at + interval '24 hours'),
  CHECK ((status IN ('completed','cancelled','expired')) = (terminal_at IS NOT NULL)),
  CHECK (status <> 'materialized' OR materialized_at IS NOT NULL),
  CHECK (terminal_at IS NULL OR terminal_at >= created_at)
);
CREATE INDEX web_push_intents_poll_idx ON public.web_push_notification_intents(next_attempt_at)
  WHERE status = 'pending';
CREATE INDEX web_push_intents_retention_idx ON public.web_push_notification_intents(terminal_at)
  WHERE terminal_at IS NOT NULL;

CREATE TABLE public.web_push_notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id uuid NOT NULL REFERENCES public.web_push_notification_intents(id),
  subscription_identity uuid NOT NULL,
  subscription_id uuid REFERENCES public.web_push_subscriptions(id) ON DELETE SET NULL,
  subscription_revision bigint NOT NULL CHECK (subscription_revision > 0),
  vapid_key_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deadline timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','retry','leased','accepted','failed','expired','cancelled')),
  attempt integer NOT NULL DEFAULT 0 CHECK (attempt BETWEEN 0 AND 100),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  attempt_token uuid,
  worker_id text,
  leased_at timestamptz,
  lease_expires_at timestamptz,
  terminal_at timestamptz,
  result jsonb,
  UNIQUE (intent_id, subscription_identity),
  CHECK (subscription_id IS NULL OR subscription_id = subscription_identity),
  CHECK ((status IN ('accepted','failed','expired','cancelled')) = (terminal_at IS NOT NULL)),
  CHECK (terminal_at IS NULL OR terminal_at >= created_at),
  CHECK (status <> 'leased' OR (
    attempt > 0 AND attempt_token IS NOT NULL AND worker_id IS NOT NULL
    AND leased_at IS NOT NULL AND lease_expires_at IS NOT NULL
    AND lease_expires_at > leased_at
    AND lease_expires_at <= leased_at + interval '45 seconds'
    AND lease_expires_at <= deadline
  ))
);
CREATE INDEX web_push_deliveries_subscription_idx ON public.web_push_notification_deliveries(subscription_id);
CREATE INDEX web_push_deliveries_poll_idx ON public.web_push_notification_deliveries(next_attempt_at)
  WHERE status IN ('pending','retry');
CREATE INDEX web_push_deliveries_lease_idx ON public.web_push_notification_deliveries(lease_expires_at)
  WHERE status = 'leased';
CREATE INDEX web_push_deliveries_retention_idx ON public.web_push_notification_deliveries(terminal_at)
  WHERE terminal_at IS NOT NULL;

CREATE TABLE public.web_push_worker_nonces (
  key_id text NOT NULL CHECK (octet_length(key_id) BETWEEN 1 AND 128),
  nonce text NOT NULL CHECK (octet_length(nonce) BETWEEN 1 AND 128),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '180 seconds'),
  PRIMARY KEY (key_id, nonce),
  CHECK (expires_at = created_at + interval '180 seconds')
);
CREATE INDEX web_push_nonces_retention_idx ON public.web_push_worker_nonces(expires_at);

-- History survives owner/request deletion; only config has cascading membership FKs.
CREATE FUNCTION public.web_push_storage_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_deadline timestamptz;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF TG_TABLE_NAME = 'web_push_subscriptions' THEN
      IF OLD.revoked_at IS NULL OR OLD.revoked_at > clock_timestamp() - interval '7 days'
        OR EXISTS (SELECT 1 FROM public.web_push_notification_deliveries d
          WHERE d.subscription_id = OLD.id AND d.status IN ('pending','retry','leased')) THEN
        RAISE EXCEPTION 'subscription_retention' USING ERRCODE = '23514';
      END IF;
    ELSIF OLD.terminal_at IS NULL OR OLD.terminal_at > clock_timestamp() - interval '7 days' THEN
      RAISE EXCEPTION 'terminal_retention' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_TABLE_NAME = 'web_push_subscriptions' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      IF NEW.user_id IS NOT NULL THEN
        RAISE EXCEPTION 'immutable_subscription_owner' USING ERRCODE = '23514';
      END IF;
      NEW.revoked_at := COALESCE(OLD.revoked_at, clock_timestamp());
      NEW.revision := OLD.revision + 1;
      UPDATE public.web_push_notification_deliveries SET status='cancelled',terminal_at=clock_timestamp(),
        result=jsonb_build_object('reason','owner_deleted')
      WHERE subscription_id=OLD.id AND status IN ('pending','retry','leased');
    END IF;
    IF NEW.id <> OLD.id OR NEW.endpoint <> OLD.endpoint THEN
      RAISE EXCEPTION 'immutable_subscription_identity' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'web_push_notification_intents' THEN
    IF NEW.id <> OLD.id OR NEW.created_at <> OLD.created_at OR NEW.deadline <> OLD.deadline
      OR NEW.request_id <> OLD.request_id OR NEW.recipient_user_id <> OLD.recipient_user_id
      OR NEW.don_vi_id <> OLD.don_vi_id OR NEW.event_type <> OLD.event_type
      OR NEW.payload IS DISTINCT FROM OLD.payload
      OR (OLD.terminal_at IS NOT NULL AND (NEW.terminal_at IS DISTINCT FROM OLD.terminal_at OR NEW.status <> OLD.status)) THEN
      RAISE EXCEPTION 'immutable_intent' USING ERRCODE = '23514';
    END IF;
  ELSE
    SELECT i.deadline INTO v_deadline FROM public.web_push_notification_intents i WHERE i.id = NEW.intent_id;
    IF NEW.deadline IS DISTINCT FROM v_deadline OR (TG_OP = 'INSERT' AND NEW.subscription_id IS NULL) THEN
      RAISE EXCEPTION 'invalid_delivery_snapshot' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'INSERT' AND NOT EXISTS (
      SELECT 1 FROM public.web_push_subscriptions s
      JOIN public.web_push_notification_intents i ON i.recipient_user_id=s.user_id
      WHERE i.id=NEW.intent_id AND s.id=NEW.subscription_id
        AND s.revision=NEW.subscription_revision AND s.vapid_key_version=NEW.vapid_key_version
    ) THEN
      RAISE EXCEPTION 'invalid_delivery_ownership' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'UPDATE' AND (
      NEW.id <> OLD.id OR NEW.intent_id <> OLD.intent_id OR NEW.subscription_identity <> OLD.subscription_identity
      OR NEW.subscription_revision <> OLD.subscription_revision OR NEW.vapid_key_version <> OLD.vapid_key_version
      OR NEW.created_at <> OLD.created_at OR NEW.deadline <> OLD.deadline
      OR (NEW.subscription_id IS DISTINCT FROM OLD.subscription_id AND NEW.subscription_id IS NOT NULL)
      OR (OLD.terminal_at IS NOT NULL AND (NEW.terminal_at IS DISTINCT FROM OLD.terminal_at
        OR NEW.status <> OLD.status OR NEW.result IS DISTINCT FROM OLD.result))) THEN
      RAISE EXCEPTION 'immutable_delivery' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.web_push_storage_guard() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER web_push_subscription_retention BEFORE UPDATE OR DELETE ON public.web_push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.web_push_storage_guard();
CREATE TRIGGER web_push_intent_guard BEFORE UPDATE OR DELETE ON public.web_push_notification_intents
  FOR EACH ROW EXECUTE FUNCTION public.web_push_storage_guard();
CREATE TRIGGER web_push_delivery_guard BEFORE INSERT OR UPDATE OR DELETE ON public.web_push_notification_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.web_push_storage_guard();

ALTER TABLE public.web_push_recipient_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_push_notification_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_push_notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_push_worker_nonces ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.web_push_recipient_configs FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.web_push_subscriptions FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.web_push_notification_intents FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.web_push_notification_deliveries FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.web_push_worker_nonces FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
