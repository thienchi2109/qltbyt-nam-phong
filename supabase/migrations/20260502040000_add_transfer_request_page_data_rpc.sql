-- Combine Transfers page list/kanban data and status counts into one client RPC.
-- This migration is intentionally local-only until reviewed and applied via Supabase MCP.

CREATE OR REPLACE FUNCTION public.transfer_request_page_data(
  p_q text DEFAULT NULL::text,
  p_statuses text[] DEFAULT NULL::text[],
  p_types text[] DEFAULT NULL::text[],
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_don_vi bigint DEFAULT NULL::bigint,
  p_date_from date DEFAULT NULL::date,
  p_date_to date DEFAULT NULL::date,
  p_assignee_ids bigint[] DEFAULT NULL::bigint[],
  p_view_mode text DEFAULT 'table'::text,
  p_per_column_limit integer DEFAULT 30,
  p_exclude_completed boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_user_id text := NULLIF(COALESCE(public._get_jwt_claim('user_id'), public._get_jwt_claim('sub')), '');
  v_view_mode text := COALESCE(p_view_mode, 'table');
  v_list jsonb := NULL;
  v_kanban jsonb := NULL;
  v_counts_raw jsonb := NULL;
  v_counts jsonb := NULL;
  v_total_count bigint := 0;
BEGIN
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  IF v_view_mode NOT IN ('table', 'kanban') THEN
    RAISE EXCEPTION 'Invalid view mode: %', v_view_mode USING ERRCODE = '22023';
  END IF;

  p_per_column_limit := LEAST(GREATEST(COALESCE(p_per_column_limit, 30), 1), 100);

  v_counts_raw := public.transfer_request_counts(
    p_q,
    p_don_vi,
    p_date_from,
    p_date_to,
    p_types,
    p_assignee_ids
  );

  v_total_count :=
    COALESCE((v_counts_raw->>'cho_duyet')::bigint, 0) +
    COALESCE((v_counts_raw->>'da_duyet')::bigint, 0) +
    COALESCE((v_counts_raw->>'dang_luan_chuyen')::bigint, 0) +
    COALESCE((v_counts_raw->>'da_ban_giao')::bigint, 0) +
    COALESCE((v_counts_raw->>'hoan_thanh')::bigint, 0);

  v_counts := jsonb_build_object(
    'totalCount', v_total_count,
    'columnCounts', jsonb_build_object(
      'cho_duyet', COALESCE((v_counts_raw->>'cho_duyet')::integer, 0),
      'da_duyet', COALESCE((v_counts_raw->>'da_duyet')::integer, 0),
      'dang_luan_chuyen', COALESCE((v_counts_raw->>'dang_luan_chuyen')::integer, 0),
      'da_ban_giao', COALESCE((v_counts_raw->>'da_ban_giao')::integer, 0),
      'hoan_thanh', COALESCE((v_counts_raw->>'hoan_thanh')::integer, 0)
    )
  );

  IF v_view_mode = 'kanban' THEN
    v_kanban := public.transfer_request_list(
      p_q,
      NULL,
      p_types,
      p_page,
      p_page_size,
      p_don_vi,
      p_date_from,
      p_date_to,
      p_assignee_ids,
      'kanban',
      p_per_column_limit,
      p_exclude_completed
    );
  ELSE
    v_list := public.transfer_request_list(
      p_q,
      p_statuses,
      p_types,
      p_page,
      p_page_size,
      p_don_vi,
      p_date_from,
      p_date_to,
      p_assignee_ids,
      'table',
      p_per_column_limit,
      p_exclude_completed
    );
  END IF;

  RETURN jsonb_build_object(
    'viewMode', v_view_mode,
    'list', v_list,
    'counts', v_counts,
    'kanban', v_kanban
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_request_page_data(
  text,
  text[],
  text[],
  integer,
  integer,
  bigint,
  date,
  date,
  bigint[],
  text,
  integer,
  boolean
) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.transfer_request_page_data(
  text,
  text[],
  text[],
  integer,
  integer,
  bigint,
  date,
  date,
  bigint[],
  text,
  integer,
  boolean
) FROM PUBLIC;
