-- Phase 2 of add-equipment-aggregate-global-search.
-- EXPLAIN (FORMAT JSON) was captured before this migration; no new indexes are added.

CREATE OR REPLACE FUNCTION public.equipment_aggregate_search(
  p_query text,
  p_group_by text DEFAULT 'region',
  p_region_id bigint DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_user_id text := NULLIF(COALESCE(public._get_jwt_claim('user_id'), public._get_jwt_claim('sub')), '');
  v_query text := NULLIF(BTRIM(COALESCE(p_query, '')), '');
  v_sanitized_query text;
  v_group_by text := COALESCE(lower(NULLIF(BTRIM(COALESCE(p_group_by, 'region')), '')), 'region');
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_allowed_facilities bigint[] := NULL;
  v_rows jsonb := '[]'::jsonb;
  v_summary jsonb := '{}'::jsonb;
  v_scope_label text;
BEGIN
  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  IF v_role NOT IN ('global', 'regional_leader') THEN
    RAISE EXCEPTION 'Access denied for role %', v_role USING ERRCODE = '42501';
  END IF;

  IF v_query IS NULL THEN
    RAISE EXCEPTION 'Search query is required' USING ERRCODE = '22023';
  END IF;

  IF v_group_by NOT IN ('region', 'facility') THEN
    RAISE EXCEPTION 'Unsupported group_by %', p_group_by USING ERRCODE = '22023';
  END IF;

  v_sanitized_query := public._sanitize_ilike_pattern(v_query);
  IF v_sanitized_query IS NULL THEN
    RAISE EXCEPTION 'Search query is required' USING ERRCODE = '22023';
  END IF;

  IF v_role = 'regional_leader' THEN
    v_allowed_facilities := public.allowed_don_vi_for_session_safe();
    IF v_allowed_facilities IS NULL OR cardinality(v_allowed_facilities) = 0 THEN
      v_allowed_facilities := ARRAY[]::bigint[];
    END IF;
  END IF;

  WITH scoped_facilities AS (
    SELECT
      dv.id AS facility_id,
      dv.name AS facility_name,
      dv.dia_ban_id AS region_id,
      db.ten_dia_ban AS region_name
    FROM public.don_vi dv
    LEFT JOIN public.dia_ban db ON db.id = dv.dia_ban_id
    WHERE dv.active = true
      AND (v_role = 'global' OR dv.id = ANY(v_allowed_facilities))
      AND (p_region_id IS NULL OR dv.dia_ban_id = p_region_id)
  ),
  matched_equipment AS (
    SELECT tb.id, tb.don_vi AS facility_id, tb.nhom_thiet_bi_id, sf.region_id, sf.region_name, sf.facility_name
    FROM scoped_facilities sf
    JOIN public.thiet_bi tb ON tb.don_vi = sf.facility_id
    WHERE tb.is_deleted = false
      AND tb.ten_thiet_bi ILIKE ('%' || v_sanitized_query || '%')

    UNION

    SELECT tb.id, tb.don_vi AS facility_id, tb.nhom_thiet_bi_id, sf.region_id, sf.region_name, sf.facility_name
    FROM scoped_facilities sf
    JOIN public.thiet_bi tb ON tb.don_vi = sf.facility_id
    WHERE tb.is_deleted = false
      AND tb.model ILIKE ('%' || v_sanitized_query || '%')

    UNION

    SELECT tb.id, tb.don_vi AS facility_id, tb.nhom_thiet_bi_id, sf.region_id, sf.region_name, sf.facility_name
    FROM scoped_facilities sf
    JOIN public.thiet_bi tb ON tb.don_vi = sf.facility_id
    WHERE tb.is_deleted = false
      AND tb.serial ILIKE ('%' || v_sanitized_query || '%')

    UNION

    SELECT tb.id, tb.don_vi AS facility_id, tb.nhom_thiet_bi_id, sf.region_id, sf.region_name, sf.facility_name
    FROM scoped_facilities sf
    JOIN public.thiet_bi tb ON tb.don_vi = sf.facility_id
    JOIN public.nhom_thiet_bi ntb ON ntb.id = tb.nhom_thiet_bi_id AND ntb.don_vi_id = tb.don_vi
    WHERE tb.is_deleted = false
      AND (
        ntb.ten_nhom ILIKE ('%' || v_sanitized_query || '%')
        OR EXISTS (
          SELECT 1
          FROM unnest(COALESCE(ntb.tu_khoa, ARRAY[]::text[])) AS kw(keyword)
          WHERE kw.keyword ILIKE ('%' || v_sanitized_query || '%')
        )
      )
  ),
  active_decisions AS (
    SELECT DISTINCT ON (qd.don_vi_id)
      qd.don_vi_id AS facility_id,
      qd.id AS decision_id
    FROM public.quyet_dinh_dinh_muc qd
    JOIN (SELECT DISTINCT facility_id FROM matched_equipment) mf ON mf.facility_id = qd.don_vi_id
    WHERE qd.trang_thai = 'active'
    ORDER BY qd.don_vi_id, qd.ngay_hieu_luc DESC NULLS LAST, qd.id DESC
  ),
  matched_groups AS (
    SELECT
      me.facility_id,
      me.nhom_thiet_bi_id,
      COUNT(*)::bigint AS matched_count
    FROM matched_equipment me
    GROUP BY me.facility_id, me.nhom_thiet_bi_id
  ),
  group_current_counts AS (
    SELECT
      mg.facility_id,
      mg.nhom_thiet_bi_id,
      COUNT(tb.id)::bigint AS current_count
    FROM matched_groups mg
    JOIN public.thiet_bi tb
      ON tb.don_vi = mg.facility_id
     AND tb.nhom_thiet_bi_id = mg.nhom_thiet_bi_id
     AND tb.is_deleted = false
    WHERE mg.nhom_thiet_bi_id IS NOT NULL
    GROUP BY mg.facility_id, mg.nhom_thiet_bi_id
  ),
  group_quota_status AS (
    SELECT
      mg.facility_id,
      mg.nhom_thiet_bi_id,
      mg.matched_count,
      ad.decision_id,
      cd.so_luong_toi_thieu,
      cd.so_luong_toi_da,
      COALESCE(gcc.current_count, 0)::bigint AS current_count,
      CASE
        WHEN ad.decision_id IS NULL THEN 'no_active_quota'
        WHEN mg.nhom_thiet_bi_id IS NULL THEN 'unassigned_category'
        WHEN cd.nhom_thiet_bi_id IS NULL THEN 'not_in_unit_quota'
        WHEN COALESCE(gcc.current_count, 0) < cd.so_luong_toi_thieu THEN 'below_minimum'
        WHEN COALESCE(gcc.current_count, 0) > cd.so_luong_toi_da THEN 'over_limit'
        ELSE 'within_limit'
      END AS quota_status
    FROM matched_groups mg
    LEFT JOIN active_decisions ad ON ad.facility_id = mg.facility_id
    LEFT JOIN public.chi_tiet_dinh_muc cd
      ON cd.quyet_dinh_id = ad.decision_id
     AND cd.nhom_thiet_bi_id = mg.nhom_thiet_bi_id
    LEFT JOIN group_current_counts gcc
      ON gcc.facility_id = mg.facility_id
     AND gcc.nhom_thiet_bi_id = mg.nhom_thiet_bi_id
  ),
  facility_quota AS (
    SELECT
      gqs.facility_id,
      CASE
        WHEN COUNT(DISTINCT gqs.quota_status) > 1 THEN 'mixed'
        ELSE MIN(gqs.quota_status)
      END AS quota_status,
      SUM(gqs.current_count) FILTER (WHERE gqs.so_luong_toi_da IS NOT NULL)::bigint AS quota_current_count,
      SUM(gqs.so_luong_toi_thieu) FILTER (WHERE gqs.so_luong_toi_thieu IS NOT NULL)::bigint AS quota_min_count,
      SUM(gqs.so_luong_toi_da) FILTER (WHERE gqs.so_luong_toi_da IS NOT NULL)::bigint AS quota_max_count,
      array_agg(DISTINCT gqs.quota_status ORDER BY gqs.quota_status) AS quota_notes
    FROM group_quota_status gqs
    GROUP BY gqs.facility_id
  ),
  region_rows AS (
    SELECT
      'region'::text AS group_type,
      me.region_id AS group_id,
      COALESCE(me.region_name, 'Chưa phân vùng') AS group_name,
      NULL::bigint AS parent_region_id,
      NULL::text AS parent_region_name,
      COUNT(me.id)::bigint AS equipment_count,
      COUNT(DISTINCT me.facility_id)::bigint AS facility_count,
      NULL::bigint AS quota_current_count,
      NULL::bigint AS quota_min_count,
      NULL::bigint AS quota_max_count,
      NULL::text AS quota_status,
      ARRAY[]::text[] AS quota_notes
    FROM matched_equipment me
    GROUP BY me.region_id, me.region_name
  ),
  facility_rows AS (
    SELECT
      'facility'::text AS group_type,
      me.facility_id AS group_id,
      me.facility_name AS group_name,
      me.region_id AS parent_region_id,
      me.region_name AS parent_region_name,
      COUNT(me.id)::bigint AS equipment_count,
      1::bigint AS facility_count,
      fq.quota_current_count,
      fq.quota_min_count,
      fq.quota_max_count,
      fq.quota_status,
      COALESCE(fq.quota_notes, ARRAY[]::text[]) AS quota_notes
    FROM matched_equipment me
    LEFT JOIN facility_quota fq ON fq.facility_id = me.facility_id
    GROUP BY
      me.facility_id,
      me.facility_name,
      me.region_id,
      me.region_name,
      fq.quota_current_count,
      fq.quota_min_count,
      fq.quota_max_count,
      fq.quota_status,
      fq.quota_notes
  ),
  selected_rows AS (
    SELECT *
    FROM region_rows
    WHERE v_group_by = 'region'
    UNION ALL
    SELECT *
    FROM facility_rows
    WHERE v_group_by = 'facility'
  ),
  limited_rows AS (
    SELECT *
    FROM selected_rows
    ORDER BY equipment_count DESC, group_name ASC, group_id ASC
    LIMIT v_limit
  ),
  totals AS (
    SELECT
      COUNT(*)::bigint AS total_equipment_count,
      COUNT(DISTINCT region_id)::bigint AS region_count,
      COUNT(DISTINCT facility_id)::bigint AS facility_count
    FROM matched_equipment
  )
  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'groupType', lr.group_type,
          'groupId', lr.group_id,
          'groupName', lr.group_name,
          'parentRegionId', lr.parent_region_id,
          'parentRegionName', lr.parent_region_name,
          'equipmentCount', lr.equipment_count,
          'facilityCount', lr.facility_count,
          'quotaCurrentCount', lr.quota_current_count,
          'quotaMinCount', lr.quota_min_count,
          'quotaMaxCount', lr.quota_max_count,
          'quotaStatus', lr.quota_status,
          'quotaNotes', lr.quota_notes
        )
        ORDER BY lr.equipment_count DESC, lr.group_name ASC, lr.group_id ASC
      ) FILTER (WHERE lr.group_type IS NOT NULL),
      '[]'::jsonb
    ),
    jsonb_build_object(
      'totalEquipmentCount', COALESCE(MAX(t.total_equipment_count), 0),
      'regionCount', COALESCE(MAX(t.region_count), 0),
      'facilityCount', COALESCE(MAX(t.facility_count), 0),
      'query', v_query,
      'scopeLabel', v_scope_label
    )
  INTO v_rows, v_summary
  FROM totals t
  LEFT JOIN limited_rows lr ON true;

  IF v_role = 'global' THEN
    v_scope_label := CASE WHEN p_region_id IS NULL THEN 'Toàn hệ thống' ELSE 'Theo địa bàn' END;
  ELSE
    v_scope_label := 'Địa bàn phụ trách';
  END IF;

  v_summary := jsonb_set(v_summary, '{scopeLabel}', to_jsonb(v_scope_label));

  RETURN jsonb_build_object(
    'rows', v_rows,
    'summary', v_summary
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.equipment_aggregate_search(text, text, bigint, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.equipment_aggregate_search(text, text, bigint, integer) TO authenticated;

COMMENT ON FUNCTION public.equipment_aggregate_search(text, text, bigint, integer)
IS 'Role-scoped deterministic aggregate equipment keyword search for global/admin and regional leader users.';
