-- Update repair Web Push copy while preserving the existing payload contract.
BEGIN;

CREATE OR REPLACE FUNCTION public.web_push_payload_v1(
  p_notification_id uuid,
  p_request_id integer,
  p_title text,
  p_department text,
  p_issue text
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_title_source text := coalesce(p_title, 'Chưa có thông tin');
  v_department_source text := coalesce(p_department, 'Chưa có thông tin');
  v_issue_source text := coalesce(p_issue, 'Chưa có thông tin');
  v_title_budget integer := 256;
  v_department_budget integer := 256;
  v_issue_budget integer := 1800;
  v_excess integer;
  v_payload jsonb;
  v_step integer;
BEGIN
  FOR v_step IN 1..16 LOOP
    v_payload := jsonb_build_object(
      'version', 1,
      'notification_id', p_notification_id::text,
      'title', 'Yêu cầu sửa chữa thiết bị mới',
      'body', public.web_push_truncate_utf8(v_department_source, v_department_budget)
        || ' đề nghị sửa chữa thiết bị ' || public.web_push_truncate_utf8(v_title_source, v_title_budget)
        || E'.\nTình trạng hư hỏng: ' || public.web_push_truncate_utf8(v_issue_source, v_issue_budget) || '.',
      'url', '/repair-requests?action=view&requestId=' || p_request_id,
      'tag', 'repair-request:' || p_request_id
    );

    v_excess := octet_length(v_payload::text) - 3072;
    IF v_excess <= 0 THEN
      RETURN v_payload;
    ELSIF v_issue_budget > 3 THEN
      v_issue_budget := greatest(3, v_issue_budget - v_excess);
    ELSIF v_department_budget > 3 THEN
      v_department_budget := greatest(3, v_department_budget - v_excess);
    ELSIF v_title_budget > 3 THEN
      v_title_budget := greatest(3, v_title_budget - v_excess);
    ELSE
      EXIT;
    END IF;
  END LOOP;

  RAISE EXCEPTION 'Web Push payload exceeds 3072 bytes' USING errcode = '22001';
END;
$function$;

REVOKE ALL ON FUNCTION public.web_push_payload_v1(uuid, integer, text, text, text)
FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
