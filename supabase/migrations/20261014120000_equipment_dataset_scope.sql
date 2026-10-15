-- Equipment regular/placed dataset scope (immutable).
CREATE INDEX IF NOT EXISTS idx_thiet_bi_dataset_placed ON public.thiet_bi (don_vi, (btrim(coalesce(nguon_kinh_phi, '')))) WHERE is_deleted = false AND btrim(coalesce(nguon_kinh_phi, '')) = 'Mượn';

CREATE OR REPLACE FUNCTION public.equipment_aggregate_search(p_query text, p_group_by text, p_region_id bigint, p_limit integer, p_equipment_dataset text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
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
  IF lower(btrim(coalesce(p_equipment_dataset, ''))) NOT IN ('all', 'regular', 'placed') THEN RAISE EXCEPTION 'Invalid equipment dataset: %', p_equipment_dataset USING ERRCODE = '22023'; END IF;
    IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  IF v_role = '' THEN
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

  IF v_role = 'global' THEN
    v_scope_label := CASE WHEN p_region_id IS NULL THEN 'Toàn hệ thống' ELSE 'Theo địa bàn' END;
  ELSE
    v_scope_label := 'Địa bàn phụ trách';
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
  raw_matched_equipment AS (
    SELECT tb.id, tb.don_vi AS facility_id, tb.nhom_thiet_bi_id, sf.region_id, sf.region_name, sf.facility_name
    FROM scoped_facilities sf
    JOIN public.thiet_bi tb ON tb.don_vi = sf.facility_id
    WHERE tb.is_deleted = false AND (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'all' OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'placed' AND btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn') OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'regular' AND btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn'))
      AND (
        tb.ten_thiet_bi ILIKE ('%' || v_sanitized_query || '%')
        OR tb.model ILIKE ('%' || v_sanitized_query || '%')
        OR tb.serial ILIKE ('%' || v_sanitized_query || '%')
      )

    UNION ALL

    SELECT tb.id, tb.don_vi AS facility_id, tb.nhom_thiet_bi_id, sf.region_id, sf.region_name, sf.facility_name
    FROM scoped_facilities sf
    JOIN public.thiet_bi tb ON tb.don_vi = sf.facility_id
    JOIN public.nhom_thiet_bi ntb ON ntb.id = tb.nhom_thiet_bi_id AND ntb.don_vi_id = tb.don_vi
    WHERE tb.is_deleted = false
      AND (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'all' OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'placed' AND btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn') OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'regular' AND btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn'))
      AND (
        ntb.ten_nhom ILIKE ('%' || v_sanitized_query || '%')
        OR EXISTS (
          SELECT 1
          FROM unnest(COALESCE(ntb.tu_khoa, ARRAY[]::text[])) AS kw(keyword)
          WHERE kw.keyword ILIKE ('%' || v_sanitized_query || '%')
        )
      )
  ),
  matched_equipment AS (
    SELECT DISTINCT ON (id) id, facility_id, nhom_thiet_bi_id, region_id, region_name, facility_name
    FROM raw_matched_equipment
    ORDER BY id
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
     AND (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'all' OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'placed' AND btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn') OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'regular' AND btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn'))
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
    SELECT
      group_type,
      group_id,
      group_name,
      parent_region_id,
      parent_region_name,
      equipment_count,
      facility_count,
      quota_current_count,
      quota_min_count,
      quota_max_count,
      quota_status,
      quota_notes
    FROM region_rows
    WHERE v_group_by = 'region'
    UNION ALL
    SELECT
      group_type,
      group_id,
      group_name,
      parent_region_id,
      parent_region_name,
      equipment_count,
      facility_count,
      quota_current_count,
      quota_min_count,
      quota_max_count,
      quota_status,
      quota_notes
    FROM facility_rows
    WHERE v_group_by = 'facility'
  ),
  limited_rows AS (
    SELECT
      group_type,
      group_id,
      group_name,
      parent_region_id,
      parent_region_name,
      equipment_count,
      facility_count,
      quota_current_count,
      quota_min_count,
      quota_max_count,
      quota_status,
      quota_notes
    FROM selected_rows
    ORDER BY equipment_count DESC, group_name ASC, group_id ASC
    LIMIT v_limit
  ),
  totals AS (
    SELECT
      COUNT(*)::bigint AS total_equipment_count,
      (
        COUNT(DISTINCT region_id)
        + CASE WHEN COUNT(*) FILTER (WHERE region_id IS NULL) > 0 THEN 1 ELSE 0 END
      )::bigint AS region_count,
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

  RETURN jsonb_build_object(
    'rows', v_rows,
    'summary', v_summary
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.equipment_aggregates_for_reports(p_don_vi_array bigint[], p_khoa_phong text, p_date_from date, p_date_to date, p_equipment_dataset text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text;
  v_allowed bigint[];
  v_facilities_to_query bigint[];
  v_total_imported bigint := 0;
  v_total_exported bigint := 0;
  v_current_stock bigint := 0;
  v_result jsonb;
  v_from_ts timestamptz;
  v_to_ts_excl timestamptz;
  v_single_don_vi bigint;
BEGIN
  IF lower(btrim(coalesce(p_equipment_dataset, ''))) NOT IN ('all', 'regular', 'placed') THEN RAISE EXCEPTION 'Invalid equipment dataset: %', p_equipment_dataset USING ERRCODE = '22023'; END IF;
    v_role := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed := public.allowed_don_vi_for_session_safe();

  IF p_khoa_phong IS NOT NULL AND btrim(p_khoa_phong) = '' THEN
    p_khoa_phong := NULL;
  END IF;

  IF p_date_from IS NOT NULL THEN
    v_from_ts := (p_date_from)::timestamptz;
  END IF;
  IF p_date_to IS NOT NULL THEN
    v_to_ts_excl := ((p_date_to + 1))::timestamptz;
  END IF;

  IF v_role IN ('global', 'admin') THEN
    IF p_don_vi_array IS NULL OR array_length(p_don_vi_array, 1) IS NULL THEN
      v_facilities_to_query := NULL;
    ELSE
      v_facilities_to_query := p_don_vi_array;
    END IF;
  ELSIF v_role = 'regional_leader' THEN
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN jsonb_build_object('totalImported', 0, 'totalExported', 0, 'currentStock', 0, 'netChange', 0);
    END IF;

    IF p_don_vi_array IS NULL OR array_length(p_don_vi_array, 1) IS NULL THEN
      v_facilities_to_query := v_allowed;
    ELSE
      SELECT ARRAY_AGG(fid)
      INTO v_facilities_to_query
      FROM UNNEST(p_don_vi_array) AS fid
      WHERE fid = ANY(v_allowed);

      IF v_facilities_to_query IS NULL OR array_length(v_facilities_to_query, 1) IS NULL THEN
        RAISE EXCEPTION 'Access denied to requested facilities' USING ERRCODE = '42501';
      END IF;
    END IF;
  ELSE
    v_single_don_vi := NULLIF(public._get_jwt_claim('don_vi'), '')::bigint;
    IF v_single_don_vi IS NULL THEN
      RAISE EXCEPTION 'Missing don_vi claim for role %', v_role USING ERRCODE = '42501';
    END IF;
    v_facilities_to_query := ARRAY[v_single_don_vi];
  END IF;

  -- totalImported: historical count of equipment registered in the date range.
  -- Intentionally excludes is_deleted filter — soft-deleted equipment was still
  -- physically imported and must be reflected in the historical record.
  -- Single query: when v_facilities_to_query IS NULL the tenant condition is
  -- always TRUE (no filter), matching the previous global-user branch exactly.
  SELECT COUNT(*)
  INTO v_total_imported
  FROM public.thiet_bi tb
  WHERE (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'all' OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'placed' AND btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn') OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'regular' AND btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn'))
    AND (v_facilities_to_query IS NULL OR tb.don_vi = ANY(v_facilities_to_query))
    AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
    AND (v_from_ts IS NULL OR tb.created_at >= v_from_ts)
    AND (v_to_ts_excl IS NULL OR tb.created_at < v_to_ts_excl);

  -- totalExported: historical count of equipment transferred/disposed in the date range.
  -- Intentionally excludes is_deleted filter — the transfer/disposal event occurred
  -- regardless of the equipment's current soft-delete status.
  SELECT COUNT(DISTINCT ylc.thiet_bi_id)
  INTO v_total_exported
  FROM public.yeu_cau_luan_chuyen ylc
  INNER JOIN public.thiet_bi tb ON ylc.thiet_bi_id = tb.id
  WHERE (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'all' OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'placed' AND btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn') OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'regular' AND btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn'))
    AND (v_facilities_to_query IS NULL OR tb.don_vi = ANY(v_facilities_to_query))
    AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
    AND ylc.trang_thai IN ('da_ban_giao', 'hoan_thanh')
    AND (
      (
        ylc.loai_hinh IN ('noi_bo', 'ben_ngoai')
        AND ylc.ngay_ban_giao IS NOT NULL
        AND (v_from_ts IS NULL OR ylc.ngay_ban_giao >= v_from_ts)
        AND (v_to_ts_excl IS NULL OR ylc.ngay_ban_giao < v_to_ts_excl)
      ) OR (
        ylc.muc_dich = 'thanh_ly'
        AND ylc.ngay_hoan_thanh IS NOT NULL
        AND (v_from_ts IS NULL OR ylc.ngay_hoan_thanh >= v_from_ts)
        AND (v_to_ts_excl IS NULL OR ylc.ngay_hoan_thanh < v_to_ts_excl)
      )
    );

  -- currentStock: current active inventory count.
  -- Correctly keeps is_deleted = false — only non-deleted equipment is in stock.
  SELECT COUNT(*)
  INTO v_current_stock
  FROM public.thiet_bi tb
  WHERE tb.is_deleted = false AND (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'all' OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'placed' AND btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn') OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'regular' AND btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn'))
    AND (v_facilities_to_query IS NULL OR tb.don_vi = ANY(v_facilities_to_query))
    AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong);

  v_result := jsonb_build_object(
    'totalImported', COALESCE(v_total_imported, 0),
    'totalExported', COALESCE(v_total_exported, 0),
    'currentStock', COALESCE(v_current_stock, 0),
    'netChange', COALESCE(v_total_imported, 0) - COALESCE(v_total_exported, 0)
  );

  RETURN v_result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.equipment_count_enhanced(p_statuses text[], p_q text, p_don_vi bigint, p_khoa_phong text, p_equipment_dataset text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text;
  v_user_id text;
  v_allowed bigint[];
  v_effective_donvi bigint;
  v_cnt bigint;
  v_sanitized_q text;
  v_department_scope text;
  v_requested_department_scope text;
BEGIN
  IF lower(btrim(coalesce(p_equipment_dataset, ''))) NOT IN ('all', 'regular', 'placed') THEN RAISE EXCEPTION 'Invalid equipment dataset: %', p_equipment_dataset USING ERRCODE = '22023'; END IF;
    v_role := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_user_id := NULLIF(public._get_jwt_claim('user_id'), '');

  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  IF v_role = '' OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing required JWT claims' USING ERRCODE = '42501';
  END IF;

  v_allowed := public.allowed_don_vi_for_session_safe();

  IF v_role = 'global' THEN
    v_effective_donvi := p_don_vi;
  ELSIF v_role = 'regional_leader' THEN
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN 0;
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF p_don_vi = ANY(v_allowed) THEN
        v_effective_donvi := p_don_vi;
      ELSE
        RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING ERRCODE = '42501';
      END IF;
    ELSE
      v_effective_donvi := NULLIF(public._get_jwt_claim('don_vi'), '')::bigint;
      IF v_effective_donvi IS NULL THEN
        RETURN 0;
      END IF;
    END IF;
  ELSIF v_role IN ('to_qltb', 'qltb_khoa', 'technician', 'user') THEN
    v_effective_donvi := NULLIF(public._get_jwt_claim('don_vi'), '')::bigint;
    IF v_effective_donvi IS NULL THEN
      RAISE EXCEPTION 'Missing don_vi claim for role %', v_role USING ERRCODE = '42501';
    END IF;

    IF v_allowed IS NULL
       OR array_length(v_allowed, 1) IS NULL
       OR NOT (v_effective_donvi = ANY(v_allowed)) THEN
      RAISE EXCEPTION 'Access denied for role %', v_role USING ERRCODE = '42501';
    END IF;

    IF p_don_vi IS NOT NULL AND p_don_vi <> v_effective_donvi THEN
      RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING ERRCODE = '42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'Access denied for role %', v_role USING ERRCODE = '42501';
  END IF;

  IF v_role = 'user' THEN
    v_department_scope := public._normalize_department_scope(public._get_jwt_claim('khoa_phong'));
    IF v_department_scope IS NULL THEN
      RETURN 0;
    END IF;

    IF p_khoa_phong IS NOT NULL THEN
      v_requested_department_scope := public._normalize_department_scope(p_khoa_phong);
      IF v_requested_department_scope IS DISTINCT FROM v_department_scope THEN
        RETURN 0;
      END IF;
    END IF;
  END IF;

  v_sanitized_q := public._sanitize_ilike_pattern(p_q);

  SELECT COUNT(*)
  INTO v_cnt
  FROM public.thiet_bi tb
  WHERE tb.is_deleted = false AND (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'all' OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'placed' AND btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn') OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'regular' AND btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn'))
    AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)
    AND (
      (v_role = 'user' AND public._normalize_department_scope(tb.khoa_phong_quan_ly) = v_department_scope)
      OR
      (v_role <> 'user' AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong))
    )
    AND (
      v_sanitized_q IS NULL
      OR tb.ten_thiet_bi ILIKE ('%' || v_sanitized_q || '%')
      OR tb.ma_thiet_bi ILIKE ('%' || v_sanitized_q || '%')
    )
    AND (p_statuses IS NULL OR tb.tinh_trang_hien_tai = ANY(p_statuses));

  RETURN COALESCE(v_cnt, 0);
END;
$function$;


CREATE OR REPLACE FUNCTION public.equipment_department_distribution(p_q text, p_don_vi bigint, p_khoa_phong text, p_khoa_phong_array text[], p_nguoi_su_dung text, p_nguoi_su_dung_array text[], p_vi_tri_lap_dat text, p_vi_tri_lap_dat_array text[], p_tinh_trang text, p_tinh_trang_array text[], p_phan_loai text, p_phan_loai_array text[], p_nguon_kinh_phi text, p_nguon_kinh_phi_array text[], p_equipment_dataset text)
 RETURNS TABLE(department text, label text, count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := '';
  v_user_id TEXT := NULL;
  v_claim_donvi BIGINT := NULL;
  v_allowed_don_vi BIGINT[];
  v_effective_donvi BIGINT := NULL;
  v_department_scope TEXT;
  v_where TEXT := '1=1 AND is_deleted = false';
  v_jwt_claims JSONB;
  v_sanitized_q TEXT;
  v_unclassified_label CONSTANT TEXT := 'Chưa phân loại';
  v_empty_user_label CONSTANT TEXT := 'Chưa có người sử dụng';
  v_empty_location_label CONSTANT TEXT := 'Chưa có vị trí';
BEGIN
  IF lower(btrim(coalesce(p_equipment_dataset, ''))) NOT IN ('all', 'regular', 'placed') THEN RAISE EXCEPTION 'Invalid equipment dataset: %', p_equipment_dataset USING ERRCODE = '22023'; END IF;
  v_where := v_where || CASE lower(btrim(coalesce(p_equipment_dataset, ''))) WHEN 'placed' THEN ' AND btrim(coalesce(nguon_kinh_phi, '''')) = ''Mượn''' WHEN 'regular' THEN ' AND btrim(coalesce(nguon_kinh_phi, '''')) <> ''Mượn''' ELSE '' END;
    BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_jwt_claims := NULL;
  END;

  v_role := COALESCE(
    v_jwt_claims ->>'app_role',
    v_jwt_claims ->>'role',
    ''
  );
  v_user_id := NULLIF(v_jwt_claims ->>'user_id', '');
  v_claim_donvi := NULLIF(v_jwt_claims ->>'don_vi', '')::BIGINT;

  IF lower(v_role) = 'admin' THEN
    v_role := 'global';
  END IF;

  IF v_role = '' OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing required JWT claims' USING ERRCODE = '42501';
  END IF;

  IF lower(v_role) = 'user' THEN
    v_department_scope := public._normalize_department_scope(v_jwt_claims ->>'khoa_phong');
  END IF;

  v_allowed_don_vi := public.allowed_don_vi_for_session_safe();

  IF lower(v_role) IN ('global', 'admin') THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective_donvi := p_don_vi;
    ELSE
      v_effective_donvi := NULL;
    END IF;
  ELSE
    IF v_allowed_don_vi IS NOT NULL AND array_length(v_allowed_don_vi, 1) > 0 THEN
      IF p_don_vi IS NOT NULL THEN
        IF p_don_vi = ANY(v_allowed_don_vi) THEN
          v_effective_donvi := p_don_vi;
        ELSE
          RETURN;
        END IF;
      ELSE
        v_effective_donvi := NULL;
      END IF;
    ELSE
      RETURN;
    END IF;
  END IF;

  IF lower(v_role) = 'user' AND v_department_scope IS NULL THEN
    RETURN;
  END IF;

  IF v_effective_donvi IS NOT NULL THEN
    v_where := v_where || ' AND don_vi = ' || v_effective_donvi;
  END IF;

  IF v_effective_donvi IS NULL AND lower(v_role) NOT IN ('global', 'admin') AND v_allowed_don_vi IS NOT NULL THEN
    v_where := v_where || ' AND don_vi = ANY(ARRAY[' || array_to_string(v_allowed_don_vi, ',') || '])';
  END IF;

  IF lower(v_role) = 'user' THEN
    v_where := v_where || ' AND public._normalize_department_scope(khoa_phong_quan_ly) = '
      || quote_literal(v_department_scope);
  END IF;

  IF p_khoa_phong_array IS NOT NULL AND array_length(p_khoa_phong_array, 1) > 0 THEN
    v_where := v_where || ' AND COALESCE(NULLIF(TRIM(khoa_phong_quan_ly), ''''), ' || quote_literal(v_unclassified_label) || ') = ANY(ARRAY[' ||
               array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(p_khoa_phong_array) AS x), ',') || '])';
  ELSIF p_khoa_phong IS NOT NULL AND trim(p_khoa_phong) != '' THEN
    v_where := v_where || ' AND COALESCE(NULLIF(TRIM(khoa_phong_quan_ly), ''''), ' || quote_literal(v_unclassified_label) || ') = ' || quote_literal(p_khoa_phong);
  END IF;

  IF p_nguoi_su_dung_array IS NOT NULL AND array_length(p_nguoi_su_dung_array, 1) > 0 THEN
    v_where := v_where || ' AND COALESCE(NULLIF(TRIM(nguoi_dang_truc_tiep_quan_ly), ''''), ' || quote_literal(v_empty_user_label) || ') = ANY(ARRAY[' ||
               array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(p_nguoi_su_dung_array) AS x), ',') || '])';
  ELSIF p_nguoi_su_dung IS NOT NULL AND trim(p_nguoi_su_dung) != '' THEN
    v_where := v_where || ' AND COALESCE(NULLIF(TRIM(nguoi_dang_truc_tiep_quan_ly), ''''), ' || quote_literal(v_empty_user_label) || ') = ' || quote_literal(p_nguoi_su_dung);
  END IF;

  IF p_vi_tri_lap_dat_array IS NOT NULL AND array_length(p_vi_tri_lap_dat_array, 1) > 0 THEN
    v_where := v_where || ' AND COALESCE(NULLIF(TRIM(vi_tri_lap_dat), ''''), ' || quote_literal(v_empty_location_label) || ') = ANY(ARRAY[' ||
               array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(p_vi_tri_lap_dat_array) AS x), ',') || '])';
  ELSIF p_vi_tri_lap_dat IS NOT NULL AND trim(p_vi_tri_lap_dat) != '' THEN
    v_where := v_where || ' AND COALESCE(NULLIF(TRIM(vi_tri_lap_dat), ''''), ' || quote_literal(v_empty_location_label) || ') = ' || quote_literal(p_vi_tri_lap_dat);
  END IF;

  IF p_tinh_trang_array IS NOT NULL AND array_length(p_tinh_trang_array, 1) > 0 THEN
    v_where := v_where || ' AND COALESCE(NULLIF(TRIM(tinh_trang_hien_tai), ''''), ' || quote_literal(v_unclassified_label) || ') = ANY(ARRAY[' ||
               array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(p_tinh_trang_array) AS x), ',') || '])';
  ELSIF p_tinh_trang IS NOT NULL AND trim(p_tinh_trang) != '' THEN
    v_where := v_where || ' AND COALESCE(NULLIF(TRIM(tinh_trang_hien_tai), ''''), ' || quote_literal(v_unclassified_label) || ') = ' || quote_literal(p_tinh_trang);
  END IF;

  IF p_phan_loai_array IS NOT NULL AND array_length(p_phan_loai_array, 1) > 0 THEN
    v_where := v_where || ' AND COALESCE(NULLIF(TRIM(phan_loai_theo_nd98), ''''), ' || quote_literal(v_unclassified_label) || ') = ANY(ARRAY[' ||
               array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(p_phan_loai_array) AS x), ',') || '])';
  ELSIF p_phan_loai IS NOT NULL AND trim(p_phan_loai) != '' THEN
    v_where := v_where || ' AND COALESCE(NULLIF(TRIM(phan_loai_theo_nd98), ''''), ' || quote_literal(v_unclassified_label) || ') = ' || quote_literal(p_phan_loai);
  END IF;

  IF p_nguon_kinh_phi_array IS NOT NULL AND array_length(p_nguon_kinh_phi_array, 1) > 0 THEN
    IF 'Chưa có' = ANY(p_nguon_kinh_phi_array) THEN
      DECLARE v_non_empty_sources TEXT[];
      BEGIN
        SELECT ARRAY(SELECT x FROM unnest(p_nguon_kinh_phi_array) AS x WHERE x != 'Chưa có') INTO v_non_empty_sources;
        IF v_non_empty_sources IS NOT NULL AND array_length(v_non_empty_sources, 1) > 0 THEN
          v_where := v_where || ' AND (nguon_kinh_phi IS NULL OR TRIM(nguon_kinh_phi) = '''' OR TRIM(nguon_kinh_phi) = ANY(ARRAY[' ||
            array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(v_non_empty_sources) AS x), ',') || ']))';
        ELSE
          v_where := v_where || ' AND (nguon_kinh_phi IS NULL OR TRIM(nguon_kinh_phi) = '''')';
        END IF;
      END;
    ELSE
      v_where := v_where || ' AND TRIM(nguon_kinh_phi) = ANY(ARRAY[' ||
        array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(p_nguon_kinh_phi_array) AS x), ',') || '])';
    END IF;
  ELSIF p_nguon_kinh_phi IS NOT NULL AND trim(p_nguon_kinh_phi) != '' THEN
    IF p_nguon_kinh_phi = 'Chưa có' THEN
      v_where := v_where || ' AND (nguon_kinh_phi IS NULL OR TRIM(nguon_kinh_phi) = '''')';
    ELSE
      v_where := v_where || ' AND TRIM(nguon_kinh_phi) = ' || quote_literal(p_nguon_kinh_phi);
    END IF;
  END IF;

  v_sanitized_q := public._sanitize_ilike_pattern(p_q);

  IF v_sanitized_q IS NOT NULL THEN
    v_where := v_where || ' AND (ten_thiet_bi ILIKE ' || quote_literal('%' || v_sanitized_q || '%') ||
              ' OR ma_thiet_bi ILIKE ' || quote_literal('%' || v_sanitized_q || '%') ||
              ' OR serial ILIKE ' || quote_literal('%' || v_sanitized_q || '%') ||
              ' OR so_luu_hanh ILIKE ' || quote_literal('%' || v_sanitized_q || '%') ||
              ' OR model ILIKE ' || quote_literal('%' || v_sanitized_q || '%') || ')';
  END IF;

  RETURN QUERY EXECUTE format(
    'SELECT department,
            COALESCE(department, ''Chưa cập nhật'') AS label,
            COUNT(*)::integer AS "count"
       FROM (
         SELECT NULLIF(BTRIM(khoa_phong_quan_ly), '''') AS department
         FROM public.thiet_bi
         WHERE %s
       ) scoped
       GROUP BY department
       ORDER BY COUNT(*) DESC, label ASC',
    v_where
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.equipment_filter_buckets(p_q text, p_don_vi bigint, p_khoa_phong_array text[], p_nguoi_su_dung_array text[], p_vi_tri_lap_dat_array text[], p_tinh_trang_array text[], p_phan_loai_array text[], p_nguon_kinh_phi_array text[], p_equipment_dataset text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text;
  v_user_id text;
  v_allowed bigint[];
  v_effective bigint[];
  v_department_scope text;
  v_jwt_claims jsonb;
  v_sanitized_q text;
  v_result jsonb;
  v_catalog jsonb;
  v_unclassified_label CONSTANT text := 'Chưa phân loại';
  v_empty_user_label CONSTANT text := 'Chưa có người sử dụng';
  v_empty_location_label CONSTANT text := 'Chưa có vị trí';
  v_empty_funding_label CONSTANT text := 'Chưa có';
  v_empty_result jsonb := jsonb_build_object(
    'department', '[]'::jsonb,
    'user', '[]'::jsonb,
    'location', '[]'::jsonb,
    'status', '[]'::jsonb,
    'classification', '[]'::jsonb,
    'fundingSource', '[]'::jsonb
  );
BEGIN
  IF lower(btrim(coalesce(p_equipment_dataset, ''))) NOT IN ('all', 'regular', 'placed') THEN RAISE EXCEPTION 'Invalid equipment dataset: %', p_equipment_dataset USING ERRCODE = '22023'; END IF;
  PERFORM 1 FROM public.thiet_bi tb WHERE (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'all' OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'placed' AND btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn') OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'regular' AND btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn')) LIMIT 1;
    BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_jwt_claims := NULL;
  END;

  v_role := lower(COALESCE(
    v_jwt_claims ->> 'app_role',
    v_jwt_claims ->> 'role',
    ''
  ));
  v_user_id := NULLIF(v_jwt_claims ->> 'user_id', '');

  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  IF v_role = '' OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing required JWT claims' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.display_order), '[]'::jsonb)
  INTO v_catalog FROM public.equipment_status_catalog c;
  v_empty_result := v_empty_result || jsonb_build_object('status_catalog', v_catalog);

  v_allowed := public.allowed_don_vi_for_session_safe();

  IF v_role = 'global' THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL;
    END IF;
  ELSE
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN v_empty_result;
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF NOT (p_don_vi = ANY(v_allowed)) THEN
        RAISE EXCEPTION 'Access denied for tenant %', p_don_vi USING ERRCODE = '42501';
      END IF;
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := v_allowed;
    END IF;
  END IF;

  IF v_role = 'user' THEN
    v_department_scope := public._normalize_department_scope(v_jwt_claims ->> 'khoa_phong');
    IF v_department_scope IS NULL THEN
      RETURN v_empty_result;
    END IF;
  END IF;

  v_sanitized_q := public._sanitize_ilike_pattern(p_q);

  WITH base_equipment AS MATERIALIZED (
    SELECT
      COALESCE(NULLIF(TRIM(tb.khoa_phong_quan_ly), ''), v_unclassified_label) AS department_name,
      COALESCE(NULLIF(TRIM(tb.nguoi_dang_truc_tiep_quan_ly), ''), v_empty_user_label) AS user_name,
      COALESCE(NULLIF(TRIM(tb.vi_tri_lap_dat), ''), v_empty_location_label) AS location_name,
      COALESCE(NULLIF(TRIM(tb.tinh_trang_hien_tai), ''), v_unclassified_label) AS status_name,
      COALESCE(NULLIF(TRIM(tb.phan_loai_theo_nd98), ''), v_unclassified_label) AS classification_name,
      COALESCE(NULLIF(TRIM(tb.nguon_kinh_phi), ''), v_empty_funding_label) AS funding_source_name
    FROM public.thiet_bi tb
    WHERE (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'all' OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'placed' AND btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn') OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'regular' AND btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn'))
      AND (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
      AND tb.is_deleted = false
      AND (
        v_role <> 'user'
        OR public._normalize_department_scope(tb.khoa_phong_quan_ly) = v_department_scope
      )
      AND (
        v_sanitized_q IS NULL
        OR tb.ten_thiet_bi ILIKE '%' || v_sanitized_q || '%'
        OR tb.ma_thiet_bi ILIKE '%' || v_sanitized_q || '%'
        OR tb.serial ILIKE '%' || v_sanitized_q || '%'
        OR tb.so_luu_hanh ILIKE '%' || v_sanitized_q || '%'
        OR tb.model ILIKE '%' || v_sanitized_q || '%'
      )
  ), status_counts AS (
        SELECT status_name AS name, COUNT(*)::integer AS count
        FROM base_equipment
        WHERE (p_khoa_phong_array IS NULL OR array_length(p_khoa_phong_array, 1) IS NULL OR department_name = ANY(p_khoa_phong_array))
          AND (p_nguoi_su_dung_array IS NULL OR array_length(p_nguoi_su_dung_array, 1) IS NULL OR user_name = ANY(p_nguoi_su_dung_array))
          AND (p_vi_tri_lap_dat_array IS NULL OR array_length(p_vi_tri_lap_dat_array, 1) IS NULL OR location_name = ANY(p_vi_tri_lap_dat_array))
          AND (p_phan_loai_array IS NULL OR array_length(p_phan_loai_array, 1) IS NULL OR classification_name = ANY(p_phan_loai_array))
          AND (p_nguon_kinh_phi_array IS NULL OR array_length(p_nguon_kinh_phi_array, 1) IS NULL OR funding_source_name = ANY(p_nguon_kinh_phi_array))
        GROUP BY status_name
  )
  SELECT jsonb_build_object(
    'department', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', bucket.name, 'count', bucket.count) ORDER BY bucket.count DESC, bucket.name)
      FROM (
        SELECT department_name AS name, COUNT(*)::integer AS count
        FROM base_equipment
        WHERE (p_nguoi_su_dung_array IS NULL OR array_length(p_nguoi_su_dung_array, 1) IS NULL OR user_name = ANY(p_nguoi_su_dung_array))
          AND (p_vi_tri_lap_dat_array IS NULL OR array_length(p_vi_tri_lap_dat_array, 1) IS NULL OR location_name = ANY(p_vi_tri_lap_dat_array))
          AND (p_tinh_trang_array IS NULL OR array_length(p_tinh_trang_array, 1) IS NULL OR status_name = ANY(p_tinh_trang_array))
          AND (p_phan_loai_array IS NULL OR array_length(p_phan_loai_array, 1) IS NULL OR classification_name = ANY(p_phan_loai_array))
          AND (p_nguon_kinh_phi_array IS NULL OR array_length(p_nguon_kinh_phi_array, 1) IS NULL OR funding_source_name = ANY(p_nguon_kinh_phi_array))
        GROUP BY department_name
      ) bucket
    ), '[]'::jsonb),
    'user', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', bucket.name, 'count', bucket.count) ORDER BY bucket.count DESC, bucket.name)
      FROM (
        SELECT user_name AS name, COUNT(*)::integer AS count
        FROM base_equipment
        WHERE (p_khoa_phong_array IS NULL OR array_length(p_khoa_phong_array, 1) IS NULL OR department_name = ANY(p_khoa_phong_array))
          AND (p_vi_tri_lap_dat_array IS NULL OR array_length(p_vi_tri_lap_dat_array, 1) IS NULL OR location_name = ANY(p_vi_tri_lap_dat_array))
          AND (p_tinh_trang_array IS NULL OR array_length(p_tinh_trang_array, 1) IS NULL OR status_name = ANY(p_tinh_trang_array))
          AND (p_phan_loai_array IS NULL OR array_length(p_phan_loai_array, 1) IS NULL OR classification_name = ANY(p_phan_loai_array))
          AND (p_nguon_kinh_phi_array IS NULL OR array_length(p_nguon_kinh_phi_array, 1) IS NULL OR funding_source_name = ANY(p_nguon_kinh_phi_array))
        GROUP BY user_name
      ) bucket
    ), '[]'::jsonb),
    'location', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', bucket.name, 'count', bucket.count) ORDER BY bucket.count DESC, bucket.name)
      FROM (
        SELECT location_name AS name, COUNT(*)::integer AS count
        FROM base_equipment
        WHERE (p_khoa_phong_array IS NULL OR array_length(p_khoa_phong_array, 1) IS NULL OR department_name = ANY(p_khoa_phong_array))
          AND (p_nguoi_su_dung_array IS NULL OR array_length(p_nguoi_su_dung_array, 1) IS NULL OR user_name = ANY(p_nguoi_su_dung_array))
          AND (p_tinh_trang_array IS NULL OR array_length(p_tinh_trang_array, 1) IS NULL OR status_name = ANY(p_tinh_trang_array))
          AND (p_phan_loai_array IS NULL OR array_length(p_phan_loai_array, 1) IS NULL OR classification_name = ANY(p_phan_loai_array))
          AND (p_nguon_kinh_phi_array IS NULL OR array_length(p_nguon_kinh_phi_array, 1) IS NULL OR funding_source_name = ANY(p_nguon_kinh_phi_array))
        GROUP BY location_name
      ) bucket
    ), '[]'::jsonb),
    'status', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', options.name, 'count', options.count) ORDER BY options.display_order)
      FROM (
        SELECT c.status_value AS name, COALESCE(bucket.count, 0) AS count, c.display_order
        FROM public.equipment_status_catalog c
        LEFT JOIN status_counts bucket ON bucket.name = c.status_value
        WHERE c.is_active OR COALESCE(bucket.count, 0) > 0
        UNION ALL
        SELECT bucket.name, bucket.count, 2147483647 AS display_order
        FROM status_counts bucket WHERE NOT EXISTS (SELECT 1 FROM public.equipment_status_catalog c WHERE c.status_value = bucket.name)
      ) options
    ), '[]'::jsonb),
    'status_catalog', v_catalog,
    'classification', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', bucket.name, 'count', bucket.count) ORDER BY bucket.count DESC, bucket.name)
      FROM (
        SELECT classification_name AS name, COUNT(*)::integer AS count
        FROM base_equipment
        WHERE (p_khoa_phong_array IS NULL OR array_length(p_khoa_phong_array, 1) IS NULL OR department_name = ANY(p_khoa_phong_array))
          AND (p_nguoi_su_dung_array IS NULL OR array_length(p_nguoi_su_dung_array, 1) IS NULL OR user_name = ANY(p_nguoi_su_dung_array))
          AND (p_vi_tri_lap_dat_array IS NULL OR array_length(p_vi_tri_lap_dat_array, 1) IS NULL OR location_name = ANY(p_vi_tri_lap_dat_array))
          AND (p_tinh_trang_array IS NULL OR array_length(p_tinh_trang_array, 1) IS NULL OR status_name = ANY(p_tinh_trang_array))
          AND (p_nguon_kinh_phi_array IS NULL OR array_length(p_nguon_kinh_phi_array, 1) IS NULL OR funding_source_name = ANY(p_nguon_kinh_phi_array))
        GROUP BY classification_name
      ) bucket
    ), '[]'::jsonb),
    'fundingSource', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', bucket.name, 'count', bucket.count) ORDER BY bucket.count DESC, bucket.name)
      FROM (
        SELECT funding_source_name AS name, COUNT(*)::integer AS count
        FROM base_equipment
        WHERE (p_khoa_phong_array IS NULL OR array_length(p_khoa_phong_array, 1) IS NULL OR department_name = ANY(p_khoa_phong_array))
          AND (p_nguoi_su_dung_array IS NULL OR array_length(p_nguoi_su_dung_array, 1) IS NULL OR user_name = ANY(p_nguoi_su_dung_array))
          AND (p_vi_tri_lap_dat_array IS NULL OR array_length(p_vi_tri_lap_dat_array, 1) IS NULL OR location_name = ANY(p_vi_tri_lap_dat_array))
          AND (p_tinh_trang_array IS NULL OR array_length(p_tinh_trang_array, 1) IS NULL OR status_name = ANY(p_tinh_trang_array))
          AND (p_phan_loai_array IS NULL OR array_length(p_phan_loai_array, 1) IS NULL OR classification_name = ANY(p_phan_loai_array))
        GROUP BY funding_source_name
      ) bucket
    ), '[]'::jsonb)
  )
  INTO v_result;

  RETURN COALESCE(v_result, v_empty_result);
END;
$function$;


CREATE OR REPLACE FUNCTION public.equipment_list_enhanced(p_q text, p_sort text, p_page integer, p_page_size integer, p_don_vi bigint, p_khoa_phong text, p_khoa_phong_array text[], p_nguoi_su_dung text, p_nguoi_su_dung_array text[], p_vi_tri_lap_dat text, p_vi_tri_lap_dat_array text[], p_tinh_trang text, p_tinh_trang_array text[], p_phan_loai text, p_phan_loai_array text[], p_nguon_kinh_phi text, p_nguon_kinh_phi_array text[], p_liquidation_last boolean, p_equipment_dataset text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := '';
  v_user_id TEXT := NULL;
  v_claim_donvi BIGINT := NULL;
  v_allowed_don_vi BIGINT[];
  v_effective_donvi BIGINT := NULL;
  v_department_scope TEXT;
  v_sort_col TEXT := 'id';
  v_sort_dir TEXT := 'ASC';
  v_order_by TEXT;
  v_limit INT := GREATEST(p_page_size, 1);
  v_offset INT := GREATEST(p_page - 1, 0) * GREATEST(p_page_size, 1);
  v_where TEXT := '1=1 AND is_deleted = false';
  v_total BIGINT := 0;
  v_data JSONB := '[]'::jsonb;
  v_jwt_claims JSONB;
  v_sanitized_q TEXT;
  v_unclassified_label CONSTANT TEXT := 'Chưa phân loại';
  v_empty_user_label CONSTANT TEXT := 'Chưa có người sử dụng';
  v_empty_location_label CONSTANT TEXT := 'Chưa có vị trí';
BEGIN
  IF lower(btrim(coalesce(p_equipment_dataset, ''))) NOT IN ('all', 'regular', 'placed') THEN RAISE EXCEPTION 'Invalid equipment dataset: %', p_equipment_dataset USING ERRCODE = '22023'; END IF;
  v_where := v_where || CASE lower(btrim(coalesce(p_equipment_dataset, ''))) WHEN 'placed' THEN ' AND btrim(coalesce(nguon_kinh_phi, '''')) = ''Mượn''' WHEN 'regular' THEN ' AND btrim(coalesce(nguon_kinh_phi, '''')) <> ''Mượn''' ELSE '' END;
    BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_jwt_claims := NULL;
  END;

  v_role := COALESCE(
    v_jwt_claims ->>'app_role',
    v_jwt_claims ->>'role',
    ''
  );
  v_user_id := NULLIF(v_jwt_claims ->>'user_id', '');
  v_claim_donvi := NULLIF(v_jwt_claims ->>'don_vi', '')::BIGINT;

  IF lower(v_role) = 'admin' THEN
    v_role := 'global';
  END IF;

  IF v_role = '' OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing required JWT claims' USING ERRCODE = '42501';
  END IF;

  IF lower(v_role) = 'user' THEN
    v_department_scope := public._normalize_department_scope(v_jwt_claims ->>'khoa_phong');
  END IF;

  IF p_sort IS NOT NULL AND p_sort != '' THEN
    v_sort_col := split_part(p_sort, '.', 1);
    v_sort_dir := UPPER(COALESCE(NULLIF(split_part(p_sort, '.', 2), ''), 'ASC'));
    IF v_sort_dir NOT IN ('ASC', 'DESC') THEN
      v_sort_dir := 'ASC';
    END IF;
    IF v_sort_col NOT IN (
      'id', 'ma_thiet_bi', 'ten_thiet_bi', 'model', 'serial',
      'khoa_phong_quan_ly', 'tinh_trang_hien_tai', 'vi_tri_lap_dat',
      'nguoi_dang_truc_tiep_quan_ly', 'phan_loai_theo_nd98', 'nguon_kinh_phi', 'don_vi',
      'gia_goc', 'ngay_nhap', 'ngay_dua_vao_su_dung', 'ngay_bt_tiep_theo',
      'so_luu_hanh'
    ) THEN
      v_sort_col := 'id';
    END IF;
  END IF;

  v_order_by := format(
    'CASE WHEN EXISTS (SELECT 1 FROM public.equipment_status_catalog sc
        WHERE sc.status_value = btrim(tb.tinh_trang_hien_tai) AND sc.is_liquidation)
      OR (%L::boolean AND public._normalize_department_scope(tb.khoa_phong_quan_ly)
        = public._normalize_department_scope(''VT-TBYT- KHO THANH LÍ'')
        AND btrim(tb.tinh_trang_hien_tai) = ''Ngưng sử dụng'')
      THEN 1 ELSE 0 END ASC,
     CASE WHEN EXISTS (SELECT 1 FROM public.equipment_status_catalog sc
        WHERE sc.status_value = btrim(tb.tinh_trang_hien_tai) AND sc.is_liquidation)
      OR (%L::boolean AND public._normalize_department_scope(tb.khoa_phong_quan_ly)
        = public._normalize_department_scope(''VT-TBYT- KHO THANH LÍ'')
        AND btrim(tb.tinh_trang_hien_tai) = ''Ngưng sử dụng'')
      THEN COALESCE(NULLIF(btrim(tb.ngay_ngung_su_dung), ''''), '''') ELSE '''' END ASC,
     tb.%I %s, tb.id ASC', p_liquidation_last, p_liquidation_last, v_sort_col, v_sort_dir);

  v_allowed_don_vi := public.allowed_don_vi_for_session_safe();

  IF lower(v_role) IN ('global', 'admin') THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective_donvi := p_don_vi;
    ELSE
      v_effective_donvi := NULL;
    END IF;
  ELSE
    IF v_allowed_don_vi IS NOT NULL AND array_length(v_allowed_don_vi, 1) > 0 THEN
      IF p_don_vi IS NOT NULL THEN
        IF p_don_vi = ANY(v_allowed_don_vi) THEN
          v_effective_donvi := p_don_vi;
        ELSE
          RETURN jsonb_build_object('data', '[]'::jsonb, 'total', 0, 'page', p_page, 'pageSize', p_page_size, 'error', 'Access denied for tenant');
        END IF;
      ELSE
        v_effective_donvi := NULL;
      END IF;
    ELSE
      RETURN jsonb_build_object('data', '[]'::jsonb, 'total', 0, 'page', p_page, 'pageSize', p_page_size, 'error', 'No tenant access');
    END IF;
  END IF;

  IF lower(v_role) = 'user' AND v_department_scope IS NULL THEN
    RETURN jsonb_build_object('data', '[]'::jsonb, 'total', 0, 'page', p_page, 'pageSize', p_page_size);
  END IF;

  IF v_effective_donvi IS NOT NULL THEN
    v_where := v_where || ' AND don_vi = ' || v_effective_donvi;
  END IF;

  IF v_effective_donvi IS NULL AND lower(v_role) NOT IN ('global', 'admin') AND v_allowed_don_vi IS NOT NULL THEN
    v_where := v_where || ' AND don_vi = ANY(ARRAY[' || array_to_string(v_allowed_don_vi, ',') || '])';
  END IF;

  IF lower(v_role) = 'user' THEN
    v_where := v_where || ' AND public._normalize_department_scope(khoa_phong_quan_ly) = '
      || quote_literal(v_department_scope);
  END IF;

  IF p_khoa_phong_array IS NOT NULL AND array_length(p_khoa_phong_array, 1) > 0 THEN
    v_where := v_where || ' AND COALESCE(NULLIF(TRIM(khoa_phong_quan_ly), ''''), ' || quote_literal(v_unclassified_label) || ') = ANY(ARRAY[' ||
               array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(p_khoa_phong_array) AS x), ',') || '])';
  ELSIF p_khoa_phong IS NOT NULL AND trim(p_khoa_phong) != '' THEN
    v_where := v_where || ' AND COALESCE(NULLIF(TRIM(khoa_phong_quan_ly), ''''), ' || quote_literal(v_unclassified_label) || ') = ' || quote_literal(p_khoa_phong);
  END IF;

  IF p_nguoi_su_dung_array IS NOT NULL AND array_length(p_nguoi_su_dung_array, 1) > 0 THEN
    v_where := v_where || ' AND COALESCE(NULLIF(TRIM(nguoi_dang_truc_tiep_quan_ly), ''''), ' || quote_literal(v_empty_user_label) || ') = ANY(ARRAY[' ||
               array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(p_nguoi_su_dung_array) AS x), ',') || '])';
  ELSIF p_nguoi_su_dung IS NOT NULL AND trim(p_nguoi_su_dung) != '' THEN
    v_where := v_where || ' AND COALESCE(NULLIF(TRIM(nguoi_dang_truc_tiep_quan_ly), ''''), ' || quote_literal(v_empty_user_label) || ') = ' || quote_literal(p_nguoi_su_dung);
  END IF;

  IF p_vi_tri_lap_dat_array IS NOT NULL AND array_length(p_vi_tri_lap_dat_array, 1) > 0 THEN
    v_where := v_where || ' AND COALESCE(NULLIF(TRIM(vi_tri_lap_dat), ''''), ' || quote_literal(v_empty_location_label) || ') = ANY(ARRAY[' ||
               array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(p_vi_tri_lap_dat_array) AS x), ',') || '])';
  ELSIF p_vi_tri_lap_dat IS NOT NULL AND trim(p_vi_tri_lap_dat) != '' THEN
    v_where := v_where || ' AND COALESCE(NULLIF(TRIM(vi_tri_lap_dat), ''''), ' || quote_literal(v_empty_location_label) || ') = ' || quote_literal(p_vi_tri_lap_dat);
  END IF;

  IF p_tinh_trang_array IS NOT NULL AND array_length(p_tinh_trang_array, 1) > 0 THEN
    v_where := v_where || ' AND COALESCE(NULLIF(TRIM(tinh_trang_hien_tai), ''''), ' || quote_literal(v_unclassified_label) || ') = ANY(ARRAY[' ||
               array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(p_tinh_trang_array) AS x), ',') || '])';
  ELSIF p_tinh_trang IS NOT NULL AND trim(p_tinh_trang) != '' THEN
    v_where := v_where || ' AND COALESCE(NULLIF(TRIM(tinh_trang_hien_tai), ''''), ' || quote_literal(v_unclassified_label) || ') = ' || quote_literal(p_tinh_trang);
  END IF;

  IF p_phan_loai_array IS NOT NULL AND array_length(p_phan_loai_array, 1) > 0 THEN
    v_where := v_where || ' AND COALESCE(NULLIF(TRIM(phan_loai_theo_nd98), ''''), ' || quote_literal(v_unclassified_label) || ') = ANY(ARRAY[' ||
               array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(p_phan_loai_array) AS x), ',') || '])';
  ELSIF p_phan_loai IS NOT NULL AND trim(p_phan_loai) != '' THEN
    v_where := v_where || ' AND COALESCE(NULLIF(TRIM(phan_loai_theo_nd98), ''''), ' || quote_literal(v_unclassified_label) || ') = ' || quote_literal(p_phan_loai);
  END IF;

  IF p_nguon_kinh_phi_array IS NOT NULL AND array_length(p_nguon_kinh_phi_array, 1) > 0 THEN
    IF 'Chưa có' = ANY(p_nguon_kinh_phi_array) THEN
      DECLARE v_non_empty_sources TEXT[];
      BEGIN
        SELECT ARRAY(SELECT x FROM unnest(p_nguon_kinh_phi_array) AS x WHERE x != 'Chưa có') INTO v_non_empty_sources;
        IF v_non_empty_sources IS NOT NULL AND array_length(v_non_empty_sources, 1) > 0 THEN
          v_where := v_where || ' AND (nguon_kinh_phi IS NULL OR TRIM(nguon_kinh_phi) = '''' OR TRIM(nguon_kinh_phi) = ANY(ARRAY[' ||
            array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(v_non_empty_sources) AS x), ',') || ']))';
        ELSE
          v_where := v_where || ' AND (nguon_kinh_phi IS NULL OR TRIM(nguon_kinh_phi) = '''')';
        END IF;
      END;
    ELSE
      v_where := v_where || ' AND TRIM(nguon_kinh_phi) = ANY(ARRAY[' ||
        array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(p_nguon_kinh_phi_array) AS x), ',') || '])';
    END IF;
  ELSIF p_nguon_kinh_phi IS NOT NULL AND trim(p_nguon_kinh_phi) != '' THEN
    IF p_nguon_kinh_phi = 'Chưa có' THEN
      v_where := v_where || ' AND (nguon_kinh_phi IS NULL OR TRIM(nguon_kinh_phi) = '''')';
    ELSE
      v_where := v_where || ' AND TRIM(nguon_kinh_phi) = ' || quote_literal(p_nguon_kinh_phi);
    END IF;
  END IF;

  v_sanitized_q := public._sanitize_ilike_pattern(p_q);

  IF v_sanitized_q IS NOT NULL THEN
    v_where := v_where || ' AND (ten_thiet_bi ILIKE ' || quote_literal('%' || v_sanitized_q || '%') ||
              ' OR ma_thiet_bi ILIKE ' || quote_literal('%' || v_sanitized_q || '%') ||
              ' OR serial ILIKE ' || quote_literal('%' || v_sanitized_q || '%') ||
              ' OR so_luu_hanh ILIKE ' || quote_literal('%' || v_sanitized_q || '%') ||
              ' OR model ILIKE ' || quote_literal('%' || v_sanitized_q || '%') || ')';
  END IF;

  EXECUTE format('SELECT count(*) FROM public.thiet_bi WHERE %s', v_where) INTO v_total;

  EXECUTE format(
    'SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb) FROM (
       SELECT (jsonb_build_object(
         ''ma_thiet_bi'', tb.ma_thiet_bi,
         ''ten_thiet_bi'', tb.ten_thiet_bi,
         ''model'', tb.model,
         ''serial'', tb.serial,
         ''cau_hinh_thiet_bi'', tb.cau_hinh_thiet_bi,
         ''phu_kien_kem_theo'', tb.phu_kien_kem_theo,
         ''hang_san_xuat'', tb.hang_san_xuat,
         ''noi_san_xuat'', tb.noi_san_xuat,
         ''nam_san_xuat'', tb.nam_san_xuat,
         ''ngay_nhap'', tb.ngay_nhap,
         ''ngay_dua_vao_su_dung'', tb.ngay_dua_vao_su_dung,
         ''nguon_kinh_phi'', tb.nguon_kinh_phi,
         ''gia_goc'', tb.gia_goc,
         ''nam_tinh_hao_mon'', tb.nam_tinh_hao_mon,
         ''ty_le_hao_mon'', tb.ty_le_hao_mon,
         ''han_bao_hanh'', tb.han_bao_hanh,
         ''vi_tri_lap_dat'', tb.vi_tri_lap_dat,
         ''nguoi_dang_truc_tiep_quan_ly'', tb.nguoi_dang_truc_tiep_quan_ly,
         ''khoa_phong_quan_ly'', tb.khoa_phong_quan_ly,
         ''tinh_trang_hien_tai'', tb.tinh_trang_hien_tai,
         ''ghi_chu'', tb.ghi_chu,
         ''chu_ky_bt_dinh_ky'', tb.chu_ky_bt_dinh_ky,
         ''ngay_bt_tiep_theo'', tb.ngay_bt_tiep_theo,
         ''chu_ky_hc_dinh_ky'', tb.chu_ky_hc_dinh_ky,
         ''ngay_hc_tiep_theo'', tb.ngay_hc_tiep_theo,
         ''chu_ky_kd_dinh_ky'', tb.chu_ky_kd_dinh_ky,
         ''ngay_kd_tiep_theo'', tb.ngay_kd_tiep_theo,
         ''phan_loai_theo_nd98'', tb.phan_loai_theo_nd98,
         ''id'', tb.id,
         ''created_at'', tb.created_at,
         ''don_vi'', tb.don_vi,
         ''nguon_nhap'', tb.nguon_nhap,
         ''so_luu_hanh'', tb.so_luu_hanh,
         ''nhom_thiet_bi_id'', tb.nhom_thiet_bi_id,
         ''is_deleted'', tb.is_deleted,
         ''ngay_ngung_su_dung'', tb.ngay_ngung_su_dung,
         ''google_drive_folder_url'', dv.google_drive_folder_url,
         ''don_vi_name'', dv.name,
         ''active_repair_request_id'', ar.active_id
       )) AS t
       FROM public.thiet_bi tb
       LEFT JOIN public.don_vi dv ON dv.id = tb.don_vi
       LEFT JOIN LATERAL (
         SELECT r.id AS active_id
         FROM public.yeu_cau_sua_chua r
         WHERE r.thiet_bi_id = tb.id
           AND r.trang_thai IN (''Chờ xử lý'', ''Đã duyệt'')
         ORDER BY r.ngay_yeu_cau DESC, r.id DESC
         LIMIT 1
       ) ar ON TRUE
       WHERE %s
       ORDER BY %s
       OFFSET %s LIMIT %s
     ) sub',
    v_where, v_order_by, v_offset, v_limit
  ) INTO v_data;

  RETURN jsonb_build_object(
    'data', v_data,
    'total', v_total,
    'page', p_page,
    'pageSize', p_page_size
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.equipment_list_for_reports(p_q text, p_sort text, p_page integer, p_page_size integer, p_don_vi bigint, p_khoa_phong text, p_equipment_dataset text)
 RETURNS SETOF thiet_bi
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text;
  v_user_id text;
  v_allowed bigint[];
  v_effective_donvi bigint;
  v_sort_col text;
  v_sort_dir text;
  v_offset int;
  v_limit int;
  v_sanitized_q text;
  v_department_scope text;
  v_requested_department_scope text;
  v_dataset_where text := '';
BEGIN
  IF lower(btrim(coalesce(p_equipment_dataset, ''))) NOT IN ('all', 'regular', 'placed') THEN RAISE EXCEPTION 'Invalid equipment dataset: %', p_equipment_dataset USING ERRCODE = '22023'; END IF;
  v_dataset_where := CASE lower(btrim(coalesce(p_equipment_dataset, '')))
    WHEN 'placed' THEN ' AND btrim(coalesce(nguon_kinh_phi, '''')) = ''Mượn'''
    WHEN 'regular' THEN ' AND btrim(coalesce(nguon_kinh_phi, '''')) <> ''Mượn'''
    ELSE ''
  END;
    v_role := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_user_id := NULLIF(public._get_jwt_claim('user_id'), '');
  v_allowed := public.allowed_don_vi_for_session_safe();

  IF v_role = '' OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing required JWT claims' USING ERRCODE = '42501';
  END IF;

  IF v_role IN ('global', 'admin') THEN
    v_effective_donvi := p_don_vi;
  ELSIF v_role = 'regional_leader' THEN
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN;
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF p_don_vi = ANY(v_allowed) THEN
        v_effective_donvi := p_don_vi;
      ELSE
        RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING ERRCODE = '42501';
      END IF;
    ELSE
      v_effective_donvi := NULLIF(public._get_jwt_claim('don_vi'), '')::bigint;
      IF v_effective_donvi IS NULL THEN
        RETURN;
      END IF;
    END IF;
  ELSE
    v_effective_donvi := NULLIF(public._get_jwt_claim('don_vi'), '')::bigint;
    IF v_effective_donvi IS NULL THEN
      RAISE EXCEPTION 'Missing don_vi claim for role %', v_role USING ERRCODE = '42501';
    END IF;

    IF p_don_vi IS NOT NULL AND p_don_vi != v_effective_donvi THEN
      RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_role = 'user' THEN
    v_department_scope := public._normalize_department_scope(public._get_jwt_claim('khoa_phong'));
    IF v_department_scope IS NULL THEN
      RETURN;
    END IF;

    IF p_khoa_phong IS NOT NULL THEN
      v_requested_department_scope := public._normalize_department_scope(p_khoa_phong);
      IF v_requested_department_scope IS DISTINCT FROM v_department_scope THEN
        RETURN;
      END IF;
    END IF;
  END IF;

  v_sort_col := split_part(p_sort, '.', 1);
  v_sort_dir := CASE lower(split_part(p_sort, '.', 2)) WHEN 'desc' THEN 'DESC' ELSE 'ASC' END;
  IF v_sort_col NOT IN ('id', 'ten_thiet_bi', 'ma_thiet_bi', 'khoa_phong_quan_ly', 'don_vi') THEN
    v_sort_col := 'id';
  END IF;

  v_limit := GREATEST(COALESCE(p_page_size, 10000), 1);
  v_offset := GREATEST((p_page - 1), 0) * v_limit;
  v_sanitized_q := public._sanitize_ilike_pattern(p_q);

  RETURN QUERY EXECUTE format(
    'SELECT * FROM public.thiet_bi
     WHERE is_deleted = false' || v_dataset_where || '
       AND ($1::bigint IS NULL OR don_vi = $1)
       AND (
         ($7::text IS NOT NULL AND public._normalize_department_scope(khoa_phong_quan_ly) = $7)
         OR
         ($7::text IS NULL AND ($2::text IS NULL OR khoa_phong_quan_ly = $2))
       )
       AND ($3::text IS NULL OR ten_thiet_bi ILIKE $5 OR ma_thiet_bi ILIKE $5)
     ORDER BY %I %s
     OFFSET $4 LIMIT $6',
    v_sort_col,
    v_sort_dir
  ) USING
    v_effective_donvi,
    p_khoa_phong,
    v_sanitized_q,
    v_offset,
    ('%' || COALESCE(v_sanitized_q, '') || '%'),
    v_limit,
    CASE WHEN v_role = 'user' THEN v_department_scope ELSE NULL END;
END;
$function$;


CREATE OR REPLACE FUNCTION public.equipment_status_distribution(p_q text, p_don_vi bigint, p_khoa_phong text, p_vi_tri text, p_equipment_dataset text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text;
  v_allowed bigint[];
  v_effective_donvi bigint;
  v_search text := NULL;
  result jsonb;
  v_catalog jsonb;
  v_status_keys jsonb;
  v_empty_counts jsonb;
BEGIN
  IF lower(btrim(coalesce(p_equipment_dataset, ''))) NOT IN ('all', 'regular', 'placed') THEN RAISE EXCEPTION 'Invalid equipment dataset: %', p_equipment_dataset USING ERRCODE = '22023'; END IF;
    v_role := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed := public.allowed_don_vi_for_session_safe();
  SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.display_order), '[]'::jsonb),
    COALESCE(jsonb_object_agg(c.status_value, CASE c.status_value
      WHEN 'Hoạt động' THEN 'hoat_dong'
      WHEN 'Chờ sửa chữa' THEN 'cho_sua_chua'
      WHEN 'Chờ bảo trì' THEN 'cho_bao_tri'
      WHEN 'Chờ hiệu chuẩn/kiểm định' THEN 'cho_hieu_chuan'
      WHEN 'Ngưng sử dụng' THEN 'ngung_su_dung'
      WHEN 'Chưa có nhu cầu sử dụng' THEN 'chua_co_nhu_cau'
      ELSE c.status_value END), '{}'::jsonb)
  INTO v_catalog, v_status_keys FROM public.equipment_status_catalog c;
  SELECT COALESCE(jsonb_object_agg(k.value, 0), '{}'::jsonb) || '{"khac":0}'::jsonb
  INTO v_empty_counts
  FROM jsonb_each_text(v_status_keys) k
  JOIN public.equipment_status_catalog c ON c.status_value = k.key
  WHERE c.is_active OR k.value IN ('hoat_dong', 'cho_sua_chua', 'cho_bao_tri', 'cho_hieu_chuan', 'ngung_su_dung', 'chua_co_nhu_cau');

  IF v_role IN ('global', 'admin') THEN
    v_effective_donvi := p_don_vi;
  ELSIF v_role = 'regional_leader' THEN
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN jsonb_build_object(
        'total_equipment', 0,
        'status_counts', v_empty_counts,
        'by_department', '[]'::jsonb,
        'by_location', '[]'::jsonb,
        'departments', '[]'::jsonb,
        'locations', '[]'::jsonb
      ) || jsonb_build_object('status_catalog', v_catalog);
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF p_don_vi = ANY(v_allowed) THEN
        v_effective_donvi := p_don_vi;
      ELSE
        RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING ERRCODE = '42501';
      END IF;
    ELSE
      RETURN jsonb_build_object(
        'total_equipment', 0,
        'status_counts', v_empty_counts,
        'by_department', '[]'::jsonb,
        'by_location', '[]'::jsonb,
        'departments', '[]'::jsonb,
        'locations', '[]'::jsonb
      ) || jsonb_build_object('status_catalog', v_catalog);
    END IF;
  ELSE
    v_effective_donvi := NULLIF(public._get_jwt_claim('don_vi'), '')::bigint;
    IF v_effective_donvi IS NULL THEN
      RAISE EXCEPTION 'Missing don_vi claim for role %', v_role USING ERRCODE = '42501';
    END IF;

    IF p_don_vi IS NOT NULL AND p_don_vi != v_effective_donvi THEN
      RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_q IS NOT NULL AND length(trim(p_q)) > 0 THEN
    v_search := '%' || public._sanitize_ilike_pattern(p_q) || '%';
  END IF;

  WITH filtered AS (
    SELECT
      tb.*,
      COALESCE(NULLIF(trim(tb.khoa_phong_quan_ly), ''), U&'Ch\01B0a ph\00E2n lo\1EA1i') AS department_name,
      COALESCE(NULLIF(trim(tb.vi_tri_lap_dat), ''), U&'Ch\01B0a x\00E1c \0111\1ECBnh') AS location_name,
      NULLIF(trim(COALESCE(tb.tinh_trang_hien_tai, '')), '') AS raw_status
    FROM public.thiet_bi tb
    WHERE tb.is_deleted = false AND (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'all' OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'placed' AND btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn') OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'regular' AND btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn'))
      AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)
      AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
      AND (p_vi_tri IS NULL OR tb.vi_tri_lap_dat = p_vi_tri)
      AND (
        v_search IS NULL
        OR tb.ten_thiet_bi ILIKE v_search
        OR tb.ma_thiet_bi ILIKE v_search
      )
  ), catalog_keys AS (
    SELECT c.status_value, c.is_active, v_status_keys->>c.status_value AS status_key
    FROM public.equipment_status_catalog c
  ), mapped AS (
    SELECT f.*, COALESCE(c.status_key, 'khac') AS status_key
    FROM filtered f LEFT JOIN catalog_keys c ON c.status_value = f.raw_status
  ), totals AS (
    SELECT
      COUNT(*)::int AS total_equipment,
      COUNT(*) FILTER (WHERE status_key = 'hoat_dong')::int AS hoat_dong,
      COUNT(*) FILTER (WHERE status_key = 'cho_sua_chua')::int AS cho_sua_chua,
      COUNT(*) FILTER (WHERE status_key = 'cho_bao_tri')::int AS cho_bao_tri,
      COUNT(*) FILTER (WHERE status_key = 'cho_hieu_chuan')::int AS cho_hieu_chuan,
      COUNT(*) FILTER (WHERE status_key = 'ngung_su_dung')::int AS ngung_su_dung,
      COUNT(*) FILTER (WHERE status_key = 'chua_co_nhu_cau')::int AS chua_co_nhu_cau,
      COUNT(*) FILTER (WHERE status_key = 'Thanh lý nội bộ')::int AS thanh_ly_noi_bo,
      COUNT(*) FILTER (WHERE status_key = 'khac')::int AS khac
    FROM mapped
  )
  SELECT jsonb_build_object(
    'total_equipment', totals.total_equipment,
    'status_counts', COALESCE((
      SELECT jsonb_object_agg(k.status_key, COALESCE(counts.total, 0))
      FROM (SELECT status_key, is_active FROM catalog_keys
        UNION ALL SELECT 'khac', true) k
      LEFT JOIN (SELECT status_key, COUNT(*)::int AS total FROM mapped GROUP BY status_key) counts
        ON counts.status_key = k.status_key
      WHERE k.is_active OR COALESCE(counts.total, 0) > 0 OR k.status_key IN ('hoat_dong', 'cho_sua_chua', 'cho_bao_tri', 'cho_hieu_chuan', 'ngung_su_dung', 'chua_co_nhu_cau')
    ), '{}'::jsonb),
    'by_department', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', d.department_name, 'total', d.total)
        || COALESCE((
          SELECT jsonb_object_agg(k.status_key, COALESCE(counts.total, 0))
          FROM (SELECT status_key, is_active FROM catalog_keys UNION ALL SELECT 'khac', true) k
          LEFT JOIN (SELECT status_key, COUNT(*)::int AS total FROM mapped
            WHERE department_name = d.department_name GROUP BY status_key) counts ON counts.status_key = k.status_key
          WHERE k.is_active OR COALESCE(counts.total, 0) > 0 OR k.status_key IN ('hoat_dong', 'cho_sua_chua', 'cho_bao_tri', 'cho_hieu_chuan', 'ngung_su_dung', 'chua_co_nhu_cau')
        ), '{}'::jsonb) ORDER BY d.total DESC)
      FROM (SELECT department_name, COUNT(*)::int AS total FROM mapped GROUP BY department_name) d
    ), '[]'::jsonb),
    'by_location', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', l.location_name, 'total', l.total)
        || COALESCE((
          SELECT jsonb_object_agg(k.status_key, COALESCE(counts.total, 0))
          FROM (SELECT status_key, is_active FROM catalog_keys UNION ALL SELECT 'khac', true) k
          LEFT JOIN (SELECT status_key, COUNT(*)::int AS total FROM mapped
            WHERE location_name = l.location_name GROUP BY status_key) counts ON counts.status_key = k.status_key
          WHERE k.is_active OR COALESCE(counts.total, 0) > 0 OR k.status_key IN ('hoat_dong', 'cho_sua_chua', 'cho_bao_tri', 'cho_hieu_chuan', 'ngung_su_dung', 'chua_co_nhu_cau')
        ), '{}'::jsonb) ORDER BY l.total DESC)
      FROM (SELECT location_name, COUNT(*)::int AS total FROM mapped GROUP BY location_name) l
    ), '[]'::jsonb),
    'departments', COALESCE((
      SELECT jsonb_agg(name ORDER BY name)
      FROM (SELECT DISTINCT department_name AS name FROM mapped) AS dept_lookup
    ), '[]'::jsonb),
    'status_catalog', v_catalog,
    'locations', COALESCE((
      SELECT jsonb_agg(name ORDER BY name)
      FROM (SELECT DISTINCT location_name AS name FROM mapped) AS loc_lookup
    ), '[]'::jsonb)
  )
  INTO result
  FROM totals;

  RETURN COALESCE(result, jsonb_build_object(
    'total_equipment', 0,
    'status_counts', v_empty_counts,
    'by_department', '[]'::jsonb,
    'by_location', '[]'::jsonb,
    'departments', '[]'::jsonb,
    'locations', '[]'::jsonb
  )) || jsonb_build_object('status_catalog', v_catalog);
END;
$function$;


CREATE OR REPLACE FUNCTION public.equipment_status_distribution(p_don_vi bigint, p_khoa_phong text, p_vi_tri text, p_equipment_dataset text)
 RETURNS TABLE(tinh_trang text, so_luong bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text;
  v_allowed bigint[];
  v_effective_donvi bigint;
BEGIN
  IF lower(btrim(coalesce(p_equipment_dataset, ''))) NOT IN ('all', 'regular', 'placed') THEN RAISE EXCEPTION 'Invalid equipment dataset: %', p_equipment_dataset USING ERRCODE = '22023'; END IF;
    v_role := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed := public.allowed_don_vi_for_session_safe();

  IF v_role IN ('global', 'admin') THEN
    v_effective_donvi := p_don_vi;
  ELSIF v_role = 'regional_leader' THEN
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN;
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF p_don_vi = ANY(v_allowed) THEN
        v_effective_donvi := p_don_vi;
      ELSE
        RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING ERRCODE = '42501';
      END IF;
    ELSE
      RETURN;
    END IF;
  ELSE
    v_effective_donvi := NULLIF(public._get_jwt_claim('don_vi'), '')::bigint;
    IF v_effective_donvi IS NULL THEN
      RAISE EXCEPTION 'Missing don_vi claim for role %', v_role USING ERRCODE = '42501';
    END IF;

    IF p_don_vi IS NOT NULL AND p_don_vi != v_effective_donvi THEN
      RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT tb.id, NULLIF(TRIM(tb.tinh_trang_hien_tai), '') AS status_value
    FROM public.thiet_bi tb
    WHERE tb.is_deleted = false AND (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'all' OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'placed' AND btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn') OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'regular' AND btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn'))
      AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)
      AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
      AND (p_vi_tri IS NULL OR tb.vi_tri_lap_dat = p_vi_tri)
  ), counts AS (
    SELECT f.status_value, COUNT(*)::bigint AS total FROM filtered f GROUP BY f.status_value
  )
  SELECT c.status_value, COALESCE(counts.total, 0)::bigint
  FROM public.equipment_status_catalog c
  LEFT JOIN counts ON counts.status_value = c.status_value
  WHERE c.is_active OR COALESCE(counts.total, 0) > 0
  UNION ALL
  SELECT 'khac'::text, COUNT(*)::bigint
  FROM filtered f
  WHERE NOT EXISTS (SELECT 1 FROM public.equipment_status_catalog c WHERE c.status_value = f.status_value)
  HAVING COUNT(*) > 0;
END;
$function$;


CREATE OR REPLACE FUNCTION public.unused_equipment_report_for_reports(p_don_vi bigint, p_q text, p_khoa_phong text, p_page integer, p_page_size integer, p_sort text, p_equipment_dataset text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text;
  v_user_id text;
  v_claim_don_vi bigint;
  v_allowed bigint[];
  v_effective_don_vi bigint;
  v_sort_col text;
  v_sort_dir text;
  v_order_sql text;
  v_limit integer;
  v_offset integer;
  v_sanitized_q text;
  v_pattern text;
  v_summary jsonb;
  v_top_device_groups jsonb;
  v_departments jsonb;
  v_department_options jsonb;
  v_items jsonb;
  v_total_count integer;
  v_equipment_dataset text;
BEGIN
  v_equipment_dataset := lower(btrim(coalesce(p_equipment_dataset, '')));
  IF v_equipment_dataset NOT IN ('all', 'regular', 'placed') THEN RAISE EXCEPTION 'Invalid equipment dataset: %', p_equipment_dataset USING ERRCODE = '22023'; END IF;
    v_role := lower(coalesce(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_user_id := nullif(public._get_jwt_claim('user_id'), '');
  v_claim_don_vi := nullif(public._get_jwt_claim('don_vi'), '')::bigint;

  IF v_role = '' OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing required JWT claims' USING errcode = '42501';
  END IF;

  IF v_role IN ('global', 'admin') THEN
    IF p_don_vi IS NULL THEN
      RAISE EXCEPTION 'Facility selection is required' USING errcode = '42501';
    END IF;
    v_effective_don_vi := p_don_vi;
  ELSIF v_role = 'regional_leader' THEN
    IF p_don_vi IS NULL THEN
      RAISE EXCEPTION 'Facility selection is required' USING errcode = '42501';
    END IF;

    v_allowed := public.allowed_don_vi_for_session_safe();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL OR NOT p_don_vi = ANY(v_allowed) THEN
      RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING errcode = '42501';
    END IF;

    v_effective_don_vi := p_don_vi;
  ELSE
    IF v_claim_don_vi IS NULL THEN
      RAISE EXCEPTION 'Missing don_vi claim for role %', v_role USING errcode = '42501';
    END IF;

    IF p_don_vi IS NOT NULL AND p_don_vi <> v_claim_don_vi THEN
      RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING errcode = '42501';
    END IF;

    v_effective_don_vi := v_claim_don_vi;
  END IF;

  v_sort_col := lower(split_part(coalesce(p_sort, 'ten_thiet_bi.asc'), '.', 1));
  v_sort_dir := CASE lower(split_part(coalesce(p_sort, 'ten_thiet_bi.asc'), '.', 2))
    WHEN 'desc' THEN 'DESC'
    ELSE 'ASC'
  END;

  IF v_sort_col NOT IN ('id', 'ma_thiet_bi', 'ten_thiet_bi', 'khoa_phong_quan_ly', 'ngay_nhap', 'gia_goc', 'created_at') THEN
    v_sort_col := 'ten_thiet_bi';
  END IF;

  v_order_sql := format('%I %s, id ASC', v_sort_col, v_sort_dir);
  v_limit := LEAST(GREATEST(coalesce(p_page_size, 20), 1), 100);
  v_offset := GREATEST(coalesce(p_page, 1) - 1, 0) * v_limit;
  v_sanitized_q := public._sanitize_ilike_pattern(lower(trim(coalesce(p_q, ''))));
  v_pattern := CASE WHEN v_sanitized_q IS NULL THEN NULL ELSE '%' || v_sanitized_q || '%' END;

  WITH base_filtered AS MATERIALIZED (
    SELECT
      tb.id,
      tb.ma_thiet_bi,
      tb.ten_thiet_bi,
      tb.model,
      tb.serial,
      tb.khoa_phong_quan_ly,
      tb.ngay_nhap,
      tb.created_at,
      tb.gia_goc,
      tb.don_vi
    FROM public.thiet_bi tb
    WHERE tb.is_deleted = false AND (v_equipment_dataset = 'all' OR (v_equipment_dataset = 'placed' AND btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn') OR (v_equipment_dataset = 'regular' AND btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn'))
      AND tb.don_vi = v_effective_don_vi
      AND tb.tinh_trang_hien_tai = 'Chưa có nhu cầu sử dụng'
      AND (
        v_pattern IS NULL
        OR lower(coalesce(tb.ten_thiet_bi, '')) ILIKE v_pattern ESCAPE '\'
        OR lower(coalesce(tb.ma_thiet_bi, '')) ILIKE v_pattern ESCAPE '\'
        OR lower(coalesce(tb.model, '')) ILIKE v_pattern ESCAPE '\'
        OR lower(coalesce(tb.serial, '')) ILIKE v_pattern ESCAPE '\'
      )
  ),
  filtered AS MATERIALIZED (
    SELECT *
    FROM base_filtered
    WHERE p_khoa_phong IS NULL
      OR p_khoa_phong = ''
      OR (p_khoa_phong = 'Không xác định' AND nullif(trim(khoa_phong_quan_ly), '') IS NULL)
      OR khoa_phong_quan_ly = p_khoa_phong
  ),
  summary_data AS (
    SELECT
      count(*)::int AS total_count,
      count(DISTINCT nullif(trim(ten_thiet_bi), ''))::int AS device_type_count,
      count(DISTINCT nullif(trim(khoa_phong_quan_ly), ''))::int AS department_count,
      coalesce(sum(gia_goc), 0)::numeric AS total_original_value
    FROM filtered
  ),
  top_device_groups AS (
    SELECT
      coalesce(nullif(trim(ten_thiet_bi), ''), 'Không xác định') AS device_name,
      count(*)::int AS equipment_count,
      coalesce(sum(gia_goc), 0)::numeric AS total_original_value
    FROM filtered
    GROUP BY coalesce(nullif(trim(ten_thiet_bi), ''), 'Không xác định')
    ORDER BY equipment_count DESC, device_name ASC
    LIMIT 10
  ),
  top_departments AS (
    SELECT
      coalesce(nullif(trim(khoa_phong_quan_ly), ''), 'Không xác định') AS department_name,
      count(*)::int AS equipment_count,
      coalesce(sum(gia_goc), 0)::numeric AS total_original_value
    FROM filtered
    GROUP BY coalesce(nullif(trim(khoa_phong_quan_ly), ''), 'Không xác định')
    ORDER BY equipment_count DESC, department_name ASC
    LIMIT 10
  ),
  department_options AS (
    SELECT
      coalesce(nullif(trim(khoa_phong_quan_ly), ''), 'Không xác định') AS department_name,
      count(*)::int AS equipment_count,
      coalesce(sum(gia_goc), 0)::numeric AS total_original_value
    FROM base_filtered
    GROUP BY coalesce(nullif(trim(khoa_phong_quan_ly), ''), 'Không xác định')
    ORDER BY department_name ASC
  )
  SELECT
    jsonb_build_object(
      'totalCount', s.total_count,
      'deviceTypeCount', s.device_type_count,
      'departmentCount', s.department_count,
      'totalOriginalValue', s.total_original_value
    ),
    s.total_count,
    coalesce(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'deviceName', device_name,
            'equipmentCount', equipment_count,
            'totalOriginalValue', total_original_value
          )
          ORDER BY equipment_count DESC, device_name ASC
        )
        FROM top_device_groups
      ),
      '[]'::jsonb
    ),
    coalesce(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'departmentName', department_name,
            'equipmentCount', equipment_count,
            'totalOriginalValue', total_original_value
          )
          ORDER BY equipment_count DESC, department_name ASC
        )
        FROM top_departments
      ),
      '[]'::jsonb
    ),
    coalesce(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'departmentName', department_name,
            'equipmentCount', equipment_count,
            'totalOriginalValue', total_original_value
          )
          ORDER BY department_name ASC
        )
        FROM department_options
      ),
      '[]'::jsonb
    )
  INTO v_summary, v_total_count, v_top_device_groups, v_departments, v_department_options
  FROM summary_data s;

  EXECUTE format(
    $sql$
      WITH filtered AS (
        SELECT
          tb.id,
          tb.ma_thiet_bi,
          tb.ten_thiet_bi,
          tb.model,
          tb.serial,
          tb.khoa_phong_quan_ly,
          tb.ngay_nhap,
          tb.created_at,
          tb.gia_goc,
          tb.don_vi
        FROM public.thiet_bi tb
        WHERE tb.is_deleted = false
          AND tb.don_vi = $1
          AND ($6::text = 'all' OR ($6::text = 'placed' AND btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn') OR ($6::text = 'regular' AND btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn'))
          AND tb.tinh_trang_hien_tai = 'Chưa có nhu cầu sử dụng'
          AND (
            $2::text IS NULL
            OR $2 = ''
            OR ($2 = 'Không xác định' AND nullif(trim(tb.khoa_phong_quan_ly), '') IS NULL)
            OR tb.khoa_phong_quan_ly = $2
          )
          AND (
            $3::text IS NULL
            OR lower(coalesce(tb.ten_thiet_bi, '')) ILIKE $3 ESCAPE '\'
            OR lower(coalesce(tb.ma_thiet_bi, '')) ILIKE $3 ESCAPE '\'
            OR lower(coalesce(tb.model, '')) ILIKE $3 ESCAPE '\'
            OR lower(coalesce(tb.serial, '')) ILIKE $3 ESCAPE '\'
          )
      ),
      paged AS (
        SELECT *
        FROM filtered
        ORDER BY %s
        OFFSET $4 LIMIT $5
      )
      SELECT coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', id,
            'maThietBi', ma_thiet_bi,
            'tenThietBi', ten_thiet_bi,
            'model', model,
            'serial', serial,
            'khoaPhongQuanLy', khoa_phong_quan_ly,
            'ngayNhap', ngay_nhap,
            'createdAt', created_at,
            'giaGoc', gia_goc,
            'donVi', don_vi
          )
        ),
        '[]'::jsonb
      )
      FROM paged
    $sql$,
    v_order_sql
  )
  INTO v_items
  USING v_effective_don_vi, p_khoa_phong, v_pattern, v_offset, v_limit, v_equipment_dataset;

  RETURN jsonb_build_object(
    'summary', coalesce(v_summary, jsonb_build_object(
      'totalCount', 0,
      'deviceTypeCount', 0,
      'departmentCount', 0,
      'totalOriginalValue', 0
    )),
    'topDeviceGroups', coalesce(v_top_device_groups, '[]'::jsonb),
    'departments', coalesce(v_departments, '[]'::jsonb),
    'departmentOptions', coalesce(v_department_options, '[]'::jsonb),
    'items', coalesce(v_items, '[]'::jsonb),
    'totalCount', coalesce(v_total_count, 0),
    'page', GREATEST(coalesce(p_page, 1), 1),
    'pageSize', v_limit
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.dashboard_repair_request_stats(p_equipment_dataset text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_user_id text := NULLIF(COALESCE(public._get_jwt_claim('user_id'), public._get_jwt_claim('sub')), '');
  v_allowed bigint[] := public.allowed_don_vi_for_session_safe();
  v_department_scope text := public._normalize_department_scope(public._get_jwt_claim('khoa_phong'));
  result jsonb;
BEGIN
  IF lower(btrim(coalesce(p_equipment_dataset, ''))) NOT IN ('all', 'regular', 'placed') THEN
    RAISE EXCEPTION 'Invalid equipment dataset: %', p_equipment_dataset USING ERRCODE = '22023';
  END IF;
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;
  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;
  WITH repair_counts AS (
    SELECT
      COUNT(*) FILTER (WHERE yc.trang_thai = 'Chờ xử lý') AS pending,
      COUNT(*) FILTER (WHERE yc.trang_thai = 'Đã duyệt') AS approved,
      COUNT(*) FILTER (WHERE yc.trang_thai IN ('Hoàn thành', 'Không HT')) AS completed
    FROM public.yeu_cau_sua_chua yc
    INNER JOIN public.thiet_bi tb ON tb.id = yc.thiet_bi_id
    WHERE tb.is_deleted = false
      AND (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'all' OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'placed' AND btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn') OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'regular' AND btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn'))
      AND (v_role = 'global' OR tb.don_vi = ANY(v_allowed))
      AND (v_role <> 'user' OR public._normalize_department_scope(tb.khoa_phong_quan_ly) = v_department_scope)
  )
  SELECT jsonb_build_object('total', COALESCE(pending + approved, 0), 'pending', COALESCE(pending, 0), 'approved', COALESCE(approved, 0), 'completed', COALESCE(completed, 0)) INTO result FROM repair_counts;
  RETURN COALESCE(result, jsonb_build_object('total', 0, 'pending', 0, 'approved', 0, 'completed', 0));
END;
$function$;

-- Maintenance plans contain no equipment relation; this scoped overload keeps
-- the dataset contract while preserving the existing plan-only metric.
CREATE OR REPLACE FUNCTION public.dashboard_maintenance_plan_stats(p_equipment_dataset text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF lower(btrim(coalesce(p_equipment_dataset, ''))) NOT IN ('all', 'regular', 'placed') THEN
    RAISE EXCEPTION 'Invalid equipment dataset: %', p_equipment_dataset USING ERRCODE = '22023';
  END IF;
  RETURN public.dashboard_maintenance_plan_stats();
END;
$function$;

REVOKE ALL ON FUNCTION public.dashboard_repair_request_stats(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_repair_request_stats(text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.dashboard_maintenance_plan_stats(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_maintenance_plan_stats(text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.equipment_list_enhanced(text,text,integer,integer,bigint,text,text[],text,text[],text,text[],text,text[],text,text[],text,text[],boolean,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.equipment_list_enhanced(text,text,integer,integer,bigint,text,text[],text,text[],text,text[],text,text[],text,text[],text,text[],boolean,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.equipment_list_enhanced(text,text,integer,integer,bigint,text,text[],text,text[],text,text[],text,text[],text,text[],text,text[],boolean,text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.equipment_department_distribution(text,bigint,text,text[],text,text[],text,text[],text,text[],text,text[],text,text[],text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.equipment_department_distribution(text,bigint,text,text[],text,text[],text,text[],text,text[],text,text[],text,text[],text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.equipment_filter_buckets(text,bigint,text[],text[],text[],text[],text[],text[],text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.equipment_filter_buckets(text,bigint,text[],text[],text[],text[],text[],text[],text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.equipment_count_enhanced(text[],text,bigint,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.equipment_count_enhanced(text[],text,bigint,text,text) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.equipment_status_distribution(text,bigint,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.equipment_status_distribution(text,bigint,text,text,text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.equipment_status_distribution(bigint,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.equipment_status_distribution(bigint,text,text,text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.equipment_list_for_reports(text,text,integer,integer,bigint,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.equipment_list_for_reports(text,text,integer,integer,bigint,text,text) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.equipment_aggregates_for_reports(bigint[],text,date,date,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.equipment_aggregates_for_reports(bigint[],text,date,date,text) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.unused_equipment_report_for_reports(bigint,text,text,integer,integer,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unused_equipment_report_for_reports(bigint,text,text,integer,integer,text,text) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.equipment_aggregate_search(text,text,bigint,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.equipment_aggregate_search(text,text,bigint,integer,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.dashboard_equipment_total(p_equipment_dataset text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_jwt_claims jsonb;
  v_role text;
  v_user_id text;
  v_allowed_don_vi bigint[];
  v_department_scope text;
  result integer;
BEGIN
  IF lower(btrim(coalesce(p_equipment_dataset, ''))) NOT IN ('all', 'regular', 'placed') THEN RAISE EXCEPTION 'Invalid equipment dataset: %', p_equipment_dataset USING ERRCODE = '22023'; END IF;
    v_jwt_claims := COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  v_role := lower(COALESCE(v_jwt_claims->>'app_role', v_jwt_claims->>'role', ''));
  v_user_id := NULLIF(COALESCE(v_jwt_claims->>'user_id', v_jwt_claims->>'sub'), '');

  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  v_allowed_don_vi := public.allowed_don_vi_for_session_safe();

  IF v_role <> 'global'
     AND (v_allowed_don_vi IS NULL OR array_length(v_allowed_don_vi, 1) IS NULL) THEN
    RETURN 0;
  END IF;

  IF v_role = 'user' THEN
    v_department_scope := public._normalize_department_scope(v_jwt_claims->>'khoa_phong');
    IF v_department_scope IS NULL THEN
      RETURN 0;
    END IF;
  END IF;

  SELECT COUNT(*)::integer INTO result
  FROM public.thiet_bi tb
  WHERE tb.is_deleted = false AND (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'all' OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'placed' AND btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn') OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'regular' AND btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn'))
    AND (
      v_role = 'global'
      OR tb.don_vi = ANY(v_allowed_don_vi)
    )
    AND (
      v_role <> 'user'
      OR public._normalize_department_scope(tb.khoa_phong_quan_ly) = v_department_scope
    );

  RETURN COALESCE(result, 0);
END;
$function$;


CREATE OR REPLACE FUNCTION public.dashboard_kpi_summary(p_equipment_dataset text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text;
  v_user_id text;
  v_jwt_claims jsonb;
BEGIN
  IF lower(btrim(coalesce(p_equipment_dataset, ''))) NOT IN ('all', 'regular', 'placed') THEN RAISE EXCEPTION 'Invalid equipment dataset: %', p_equipment_dataset USING ERRCODE = '22023'; END IF;
  PERFORM 1 FROM public.thiet_bi tb WHERE (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'all' OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'placed' AND btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn') OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'regular' AND btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn')) LIMIT 1;
    BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_jwt_claims := NULL;
  END;

  v_role := lower(COALESCE(
    v_jwt_claims ->> 'app_role',
    v_jwt_claims ->> 'role',
    ''
  ));
  v_user_id := NULLIF(v_jwt_claims ->> 'user_id', '');

  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  IF v_role = '' OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing required JWT claims' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'totalEquipment', public.dashboard_equipment_total(p_equipment_dataset),
    'maintenanceCount', public.dashboard_maintenance_count(p_equipment_dataset),
    'repairRequests', public.dashboard_repair_request_stats(p_equipment_dataset),
    'maintenancePlans', public.dashboard_maintenance_plan_stats(p_equipment_dataset)
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.dashboard_maintenance_count(p_equipment_dataset text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_jwt_claims jsonb;
  v_role text;
  v_user_id text;
  v_allowed_don_vi bigint[];
  v_department_scope text;
  result integer;
BEGIN
  IF lower(btrim(coalesce(p_equipment_dataset, ''))) NOT IN ('all', 'regular', 'placed') THEN RAISE EXCEPTION 'Invalid equipment dataset: %', p_equipment_dataset USING ERRCODE = '22023'; END IF;
    v_jwt_claims := COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  v_role := lower(COALESCE(v_jwt_claims->>'app_role', v_jwt_claims->>'role', ''));
  v_user_id := NULLIF(COALESCE(v_jwt_claims->>'user_id', v_jwt_claims->>'sub'), '');

  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  v_allowed_don_vi := public.allowed_don_vi_for_session_safe();

  IF v_role <> 'global'
     AND (v_allowed_don_vi IS NULL OR array_length(v_allowed_don_vi, 1) IS NULL) THEN
    RETURN 0;
  END IF;

  IF v_role = 'user' THEN
    v_department_scope := public._normalize_department_scope(v_jwt_claims->>'khoa_phong');
    IF v_department_scope IS NULL THEN
      RETURN 0;
    END IF;
  END IF;

  SELECT COUNT(*)::integer INTO result
  FROM public.thiet_bi tb
  WHERE tb.is_deleted = false AND (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'all' OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'placed' AND btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn') OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'regular' AND btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn'))
    AND (
      v_role = 'global'
      OR tb.don_vi = ANY(v_allowed_don_vi)
    )
    AND (
      v_role <> 'user'
      OR public._normalize_department_scope(tb.khoa_phong_quan_ly) = v_department_scope
    )
    AND (
      tb.tinh_trang_hien_tai ILIKE '%Chờ bảo trì%'
      OR tb.tinh_trang_hien_tai ILIKE '%Chờ hiệu chuẩn%'
      OR tb.tinh_trang_hien_tai ILIKE '%Chờ kiểm định%'
      OR tb.tinh_trang_hien_tai ILIKE '%bảo trì%'
      OR tb.tinh_trang_hien_tai ILIKE '%hiệu chuẩn%'
      OR tb.tinh_trang_hien_tai ILIKE '%kiểm định%'
    );

  RETURN COALESCE(result, 0);
END;
$function$;


CREATE OR REPLACE FUNCTION public.dinh_muc_compliance_detail(p_quyet_dinh_id bigint, p_don_vi bigint, p_equipment_dataset text)
 RETURNS TABLE(quyet_dinh_id bigint, nhom_thiet_bi_id bigint, ma_nhom text, ten_nhom text, phan_loai text, so_luong_toi_thieu integer, so_luong_toi_da integer, so_luong_hien_co bigint, trang_thai_tuan_thu text, chenh_lech integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
  v_decision_id BIGINT;
  v_decision_don_vi BIGINT;
  v_allowed_facilities BIGINT[];
BEGIN
  IF lower(btrim(coalesce(p_equipment_dataset, ''))) NOT IN ('all', 'regular', 'placed') THEN
    RAISE EXCEPTION 'Invalid equipment dataset: %', p_equipment_dataset USING ERRCODE = '22023';
  END IF;
  -- Fallback for older tokens using 'role' instead of 'app_role'
  IF v_role IS NULL OR v_role = '' THEN
    v_role := current_setting('request.jwt.claims', true)::json->>'role';
  END IF;

  -- Tenant isolation based on role
  IF v_role IN ('global', 'admin') THEN
    -- Global/admin can access any tenant (use provided p_don_vi)
    NULL;
  ELSIF v_role = 'regional_leader' THEN
    -- Regional leader: validate p_don_vi against allowed facilities
    v_allowed_facilities := public.allowed_don_vi_for_session();
    IF p_don_vi IS NULL OR NOT (p_don_vi = ANY(v_allowed_facilities)) THEN
      RAISE EXCEPTION 'Access denied: facility % is not in your region', p_don_vi;
    END IF;
  ELSE
    -- Other roles: force to their own tenant
    p_don_vi := NULLIF(v_don_vi, '')::BIGINT;
  END IF;

  -- If still no tenant specified, return empty
  IF p_don_vi IS NULL THEN
    RETURN;
  END IF;

  -- Determine which decision to use
  IF p_quyet_dinh_id IS NOT NULL THEN
    -- Verify decision belongs to this tenant
    SELECT qd.id, qd.don_vi_id INTO v_decision_id, v_decision_don_vi
    FROM public.quyet_dinh_dinh_muc qd
    WHERE qd.id = p_quyet_dinh_id;

    IF v_decision_don_vi IS NULL OR v_decision_don_vi != p_don_vi THEN
      -- Decision not found or belongs to different tenant
      RETURN;
    END IF;
  ELSE
    -- Find active decision for this tenant
    SELECT qd.id INTO v_decision_id
    FROM public.quyet_dinh_dinh_muc qd
    WHERE qd.don_vi_id = p_don_vi
      AND qd.trang_thai = 'active'
    ORDER BY qd.ngay_hieu_luc DESC
    LIMIT 1;

    -- No active decision found
    IF v_decision_id IS NULL THEN
      RETURN;
    END IF;
  END IF;

  -- Return compliance details for each category in the decision
  RETURN QUERY
  WITH equipment_counts AS (
    -- Count equipment per category for this tenant
    SELECT
      tb.nhom_thiet_bi_id,
      COUNT(*)::BIGINT AS cnt
    FROM public.thiet_bi tb
    WHERE (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'all' OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'placed' AND btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn') OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'regular' AND btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn'))
      AND tb.don_vi = p_don_vi
      AND tb.nhom_thiet_bi_id IS NOT NULL
    GROUP BY tb.nhom_thiet_bi_id
  ),
  compliance_data AS (
    SELECT
      v_decision_id AS quyet_dinh_id,
      ntb.id AS nhom_thiet_bi_id,
      ntb.ma_nhom,
      ntb.ten_nhom,
      ntb.phan_loai,
      cd.so_luong_toi_thieu,
      cd.so_luong_toi_da,
      COALESCE(ec.cnt, 0)::BIGINT AS so_luong_hien_co,
      CASE
        WHEN COALESCE(ec.cnt, 0) < cd.so_luong_toi_thieu THEN 'thieu'
        WHEN COALESCE(ec.cnt, 0) > cd.so_luong_toi_da THEN 'vuot'
        ELSE 'dat'
      END AS trang_thai_tuan_thu,
      -- Calculate difference from acceptable range
      -- Negative if under minimum, positive if over maximum, 0 if in range
      CASE
        WHEN COALESCE(ec.cnt, 0) < cd.so_luong_toi_thieu THEN
          (COALESCE(ec.cnt, 0) - cd.so_luong_toi_thieu)::INT
        WHEN COALESCE(ec.cnt, 0) > cd.so_luong_toi_da THEN
          (COALESCE(ec.cnt, 0) - cd.so_luong_toi_da)::INT
        ELSE 0
      END AS chenh_lech
    FROM public.chi_tiet_dinh_muc cd
    INNER JOIN public.nhom_thiet_bi ntb ON ntb.id = cd.nhom_thiet_bi_id
    LEFT JOIN equipment_counts ec ON ec.nhom_thiet_bi_id = cd.nhom_thiet_bi_id
    WHERE cd.quyet_dinh_id = v_decision_id
  )
  SELECT
    cdata.quyet_dinh_id,
    cdata.nhom_thiet_bi_id,
    cdata.ma_nhom,
    cdata.ten_nhom,
    cdata.phan_loai,
    cdata.so_luong_toi_thieu,
    cdata.so_luong_toi_da,
    cdata.so_luong_hien_co,
    cdata.trang_thai_tuan_thu,
    cdata.chenh_lech
  FROM compliance_data cdata
  ORDER BY
    -- Order by compliance status: thieu (under) first, then vuot (over), then dat (compliant)
    CASE cdata.trang_thai_tuan_thu
      WHEN 'thieu' THEN 1
      WHEN 'vuot' THEN 2
      WHEN 'dat' THEN 3
    END,
    cdata.ma_nhom;
END;
$function$;


CREATE OR REPLACE FUNCTION public.dinh_muc_compliance_summary(p_quyet_dinh_id bigint, p_don_vi bigint, p_equipment_dataset text)
 RETURNS TABLE(quyet_dinh_id bigint, so_quyet_dinh text, ten_don_vi text, total_categories bigint, dat_count bigint, thieu_count bigint, vuot_count bigint, unassigned_equipment bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
  v_decision_id BIGINT;
  v_decision_don_vi BIGINT;
  v_allowed_facilities BIGINT[];
  v_facility_name TEXT;
BEGIN
  IF lower(btrim(coalesce(p_equipment_dataset, ''))) NOT IN ('all', 'regular', 'placed') THEN
    RAISE EXCEPTION 'Invalid equipment dataset: %', p_equipment_dataset USING ERRCODE = '22023';
  END IF;
  -- Fallback for older tokens using 'role' instead of 'app_role'
  IF v_role IS NULL OR v_role = '' THEN
    v_role := current_setting('request.jwt.claims', true)::json->>'role';
  END IF;

  -- Tenant isolation based on role
  IF v_role IN ('global', 'admin') THEN
    -- Global/admin can access any tenant (use provided p_don_vi)
    NULL;
  ELSIF v_role = 'regional_leader' THEN
    -- Regional leader: validate p_don_vi against allowed facilities
    v_allowed_facilities := public.allowed_don_vi_for_session();
    IF p_don_vi IS NULL OR NOT (p_don_vi = ANY(v_allowed_facilities)) THEN
      RAISE EXCEPTION 'Access denied: facility % is not in your region', p_don_vi;
    END IF;
  ELSE
    -- Other roles: force to their own tenant
    p_don_vi := NULLIF(v_don_vi, '')::BIGINT;
  END IF;

  -- If still no tenant specified, return empty
  IF p_don_vi IS NULL THEN
    RETURN;
  END IF;

  -- Fetch facility name for report headers
  SELECT dv.name INTO v_facility_name
  FROM public.don_vi dv
  WHERE dv.id = p_don_vi;

  -- Determine which decision to use
  IF p_quyet_dinh_id IS NOT NULL THEN
    -- Verify decision belongs to this tenant
    SELECT qd.id, qd.don_vi_id INTO v_decision_id, v_decision_don_vi
    FROM public.quyet_dinh_dinh_muc qd
    WHERE qd.id = p_quyet_dinh_id;

    IF v_decision_don_vi IS NULL OR v_decision_don_vi != p_don_vi THEN
      -- Decision not found or belongs to different tenant
      RETURN;
    END IF;
  ELSE
    -- Find active decision for this tenant
    SELECT qd.id INTO v_decision_id
    FROM public.quyet_dinh_dinh_muc qd
    WHERE qd.don_vi_id = p_don_vi
      AND qd.trang_thai = 'active'
    ORDER BY qd.ngay_hieu_luc DESC
    LIMIT 1;

    -- No active decision found
    IF v_decision_id IS NULL THEN
      RETURN QUERY
      SELECT
        NULL::BIGINT AS quyet_dinh_id,
        NULL::TEXT AS so_quyet_dinh,
        v_facility_name AS ten_don_vi,
        0::BIGINT AS total_categories,
        0::BIGINT AS dat_count,
        0::BIGINT AS thieu_count,
        0::BIGINT AS vuot_count,
        (
          SELECT COUNT(*)::BIGINT
          FROM public.thiet_bi tb
          WHERE (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'all' OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'placed' AND btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn') OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'regular' AND btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn'))
            AND tb.don_vi = p_don_vi
            AND tb.nhom_thiet_bi_id IS NULL
        ) AS unassigned_equipment;
      RETURN;
    END IF;
  END IF;

  -- Calculate compliance statistics
  RETURN QUERY
  WITH equipment_counts AS (
    -- Count equipment per category for this tenant
    SELECT
      tb.nhom_thiet_bi_id,
      COUNT(*)::BIGINT AS so_luong_hien_co
    FROM public.thiet_bi tb
    WHERE (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'all' OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'placed' AND btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn') OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'regular' AND btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn'))
      AND tb.don_vi = p_don_vi
      AND tb.nhom_thiet_bi_id IS NOT NULL
    GROUP BY tb.nhom_thiet_bi_id
  ),
  compliance_status AS (
    -- Calculate compliance for each line item in the decision
    SELECT
      cd.nhom_thiet_bi_id,
      cd.so_luong_toi_thieu,
      cd.so_luong_toi_da,
      COALESCE(ec.so_luong_hien_co, 0) AS so_luong_hien_co,
      CASE
        WHEN COALESCE(ec.so_luong_hien_co, 0) < cd.so_luong_toi_thieu THEN 'thieu'
        WHEN COALESCE(ec.so_luong_hien_co, 0) > cd.so_luong_toi_da THEN 'vuot'
        ELSE 'dat'
      END AS trang_thai_tuan_thu
    FROM public.chi_tiet_dinh_muc cd
    LEFT JOIN equipment_counts ec ON ec.nhom_thiet_bi_id = cd.nhom_thiet_bi_id
    WHERE cd.quyet_dinh_id = v_decision_id
  )
  SELECT
    v_decision_id AS quyet_dinh_id,
    qd.so_quyet_dinh,
    v_facility_name AS ten_don_vi,
    COUNT(*)::BIGINT AS total_categories,
    COUNT(*) FILTER (WHERE cs.trang_thai_tuan_thu = 'dat')::BIGINT AS dat_count,
    COUNT(*) FILTER (WHERE cs.trang_thai_tuan_thu = 'thieu')::BIGINT AS thieu_count,
    COUNT(*) FILTER (WHERE cs.trang_thai_tuan_thu = 'vuot')::BIGINT AS vuot_count,
    (
      SELECT COUNT(*)::BIGINT
      FROM public.thiet_bi tb
      WHERE (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'all' OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'placed' AND btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn') OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'regular' AND btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn'))
        AND tb.don_vi = p_don_vi
        AND tb.nhom_thiet_bi_id IS NULL
    ) AS unassigned_equipment
  FROM compliance_status cs
  CROSS JOIN public.quyet_dinh_dinh_muc qd
  WHERE qd.id = v_decision_id
  GROUP BY qd.so_quyet_dinh;
END;
$function$;


CREATE OR REPLACE FUNCTION public.equipment_attention_list(p_limit integer, p_equipment_dataset text)
 RETURNS SETOF thiet_bi
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := '';
  v_allowed_don_vi BIGINT[];
  v_jwt_claims JSONB;
BEGIN
  IF lower(btrim(coalesce(p_equipment_dataset, ''))) NOT IN ('all', 'regular', 'placed') THEN RAISE EXCEPTION 'Invalid equipment dataset: %', p_equipment_dataset USING ERRCODE = '22023'; END IF;
    BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;

  v_role := lower(COALESCE(
    v_jwt_claims ->> 'app_role',
    v_jwt_claims ->> 'role',
    ''
  ));

  v_allowed_don_vi := public.allowed_don_vi_for_session_safe();

  IF v_role = '' OR v_allowed_don_vi IS NULL OR array_length(v_allowed_don_vi, 1) IS NULL THEN
    RETURN;
  END IF;

  IF v_role = 'global' THEN
    RETURN QUERY
    SELECT *
    FROM public.thiet_bi tb
    WHERE tb.is_deleted = false AND (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'all' OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'placed' AND btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn') OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'regular' AND btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn'))
      AND tb.tinh_trang_hien_tai IN ('Chờ sửa chữa', 'Chờ bảo trì', 'Chờ hiệu chuẩn/kiểm định')
    ORDER BY tb.ngay_bt_tiep_theo ASC NULLS LAST
    LIMIT GREATEST(p_limit, 1);

    RETURN;
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.thiet_bi tb
  WHERE tb.don_vi = ANY(v_allowed_don_vi)
    AND (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'all' OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'placed' AND btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn') OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'regular' AND btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn'))
    AND tb.is_deleted = false
    AND tb.tinh_trang_hien_tai IN ('Chờ sửa chữa', 'Chờ bảo trì', 'Chờ hiệu chuẩn/kiểm định')
  ORDER BY tb.ngay_bt_tiep_theo ASC NULLS LAST
  LIMIT GREATEST(p_limit, 1);
END;
$function$;


CREATE OR REPLACE FUNCTION public.equipment_attention_list_paginated(p_page integer, p_page_size integer, p_equipment_dataset text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := '';
  v_allowed_don_vi BIGINT[];
  v_jwt_claims JSONB;
  v_page INT := GREATEST(COALESCE(p_page, 1), 1);
  v_page_size INT := LEAST(GREATEST(COALESCE(p_page_size, 10), 1), 50);
  v_offset INT := 0;
  v_result JSONB;
BEGIN
  IF lower(btrim(coalesce(p_equipment_dataset, ''))) NOT IN ('all', 'regular', 'placed') THEN RAISE EXCEPTION 'Invalid equipment dataset: %', p_equipment_dataset USING ERRCODE = '22023'; END IF;
  PERFORM 1 FROM public.thiet_bi tb WHERE (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'all' OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'placed' AND btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn') OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'regular' AND btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn')) LIMIT 1;
    v_offset := (v_page - 1) * v_page_size;

  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'data', '[]'::jsonb,
      'total', 0,
      'page', v_page,
      'pageSize', v_page_size,
      'hasMore', false
    );
  END;

  v_role := lower(COALESCE(
    v_jwt_claims ->> 'app_role',
    v_jwt_claims ->> 'role',
    ''
  ));

  v_allowed_don_vi := public.allowed_don_vi_for_session_safe();

  IF v_role = '' OR v_allowed_don_vi IS NULL OR array_length(v_allowed_don_vi, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'data', '[]'::jsonb,
      'total', 0,
      'page', v_page,
      'pageSize', v_page_size,
      'hasMore', false
    );
  END IF;

  WITH filtered AS (
    SELECT
      tb.id,
      tb.ten_thiet_bi,
      tb.ma_thiet_bi,
      tb.model,
      tb.tinh_trang_hien_tai,
      tb.vi_tri_lap_dat,
      tb.ngay_bt_tiep_theo
    FROM public.thiet_bi tb
    WHERE (
      v_role = 'global'
      OR tb.don_vi = ANY(v_allowed_don_vi)
    )
    AND (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'all' OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'placed' AND btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn') OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'regular' AND btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn'))
    AND tb.is_deleted = false
    AND tb.tinh_trang_hien_tai IN ('Chờ sửa chữa', 'Chờ bảo trì', 'Chờ hiệu chuẩn/kiểm định')
  ),
  totals AS (
    SELECT COUNT(*)::BIGINT AS total FROM filtered
  ),
  paged AS (
    SELECT * FROM filtered
    ORDER BY ngay_bt_tiep_theo ASC NULLS LAST, id ASC
    LIMIT v_page_size OFFSET v_offset
  )
  SELECT jsonb_build_object(
    'data', COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object(
          'id', p.id,
          'ten_thiet_bi', p.ten_thiet_bi,
          'ma_thiet_bi', p.ma_thiet_bi,
          'model', p.model,
          'tinh_trang_hien_tai', p.tinh_trang_hien_tai,
          'vi_tri_lap_dat', p.vi_tri_lap_dat,
          'ngay_bt_tiep_theo', p.ngay_bt_tiep_theo
        )) FROM paged p
      ),
      '[]'::jsonb
    ),
    'total', COALESCE((SELECT total FROM totals), 0),
    'page', v_page,
    'pageSize', v_page_size,
    'hasMore', COALESCE((SELECT total FROM totals), 0) > (v_offset + v_page_size)
  ) INTO v_result;

  RETURN COALESCE(v_result, jsonb_build_object(
    'data', '[]'::jsonb,
    'total', 0,
    'page', v_page,
    'pageSize', v_page_size,
    'hasMore', false
  ));
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_facilities_with_equipment_count(p_equipment_dataset text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := '';
  v_allowed_don_vi BIGINT[];
  v_jwt_claims JSONB;
  v_result JSONB;
BEGIN
  IF lower(btrim(coalesce(p_equipment_dataset, ''))) NOT IN ('all', 'regular', 'placed') THEN RAISE EXCEPTION 'Invalid equipment dataset: %', p_equipment_dataset USING ERRCODE = '22023'; END IF;
    BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_jwt_claims := NULL;
  END;

  v_role := COALESCE(
    v_jwt_claims ->> 'app_role',
    v_jwt_claims ->> 'role',
    ''
  );

  v_allowed_don_vi := public.allowed_don_vi_for_session_safe();

  IF lower(v_role) = 'global' THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', dv.id,
        'name', dv.name,
        'code', dv.code,
        'equipment_count', COALESCE(tb_count.cnt, 0)
      )
      ORDER BY dv.name
    )
    INTO v_result
    FROM public.don_vi dv
    LEFT JOIN (
      SELECT don_vi, COUNT(*) as cnt
      FROM public.thiet_bi
      WHERE is_deleted = false AND (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'all' OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'placed' AND btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn') OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'regular' AND btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn'))
      GROUP BY don_vi
    ) tb_count ON tb_count.don_vi = dv.id;

    RETURN COALESCE(v_result, '[]'::jsonb);
  END IF;

  IF v_allowed_don_vi IS NULL OR array_length(v_allowed_don_vi, 1) = 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', dv.id,
      'name', dv.name,
      'code', dv.code,
      'equipment_count', COALESCE(tb_count.cnt, 0)
    )
    ORDER BY dv.name
  )
  INTO v_result
  FROM public.don_vi dv
  LEFT JOIN (
    SELECT don_vi, COUNT(*) as cnt
    FROM public.thiet_bi
    WHERE don_vi = ANY(v_allowed_don_vi)
      AND is_deleted = false
    GROUP BY don_vi
  ) tb_count ON tb_count.don_vi = dv.id
  WHERE dv.id = ANY(v_allowed_don_vi);

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_maintenance_report_data(p_date_from date, p_date_to date, p_don_vi bigint, p_equipment_dataset text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text;
  v_user_id text;
  v_is_global boolean := false;
  v_allowed bigint[];
  v_effective bigint[];
  v_result jsonb;
  v_from_year integer := extract(year from p_date_from)::integer;
  v_to_year integer := extract(year from p_date_to)::integer;
BEGIN
  IF lower(btrim(coalesce(p_equipment_dataset, ''))) NOT IN ('all', 'regular', 'placed') THEN RAISE EXCEPTION 'Invalid equipment dataset: %', p_equipment_dataset USING ERRCODE = '22023'; END IF;
  PERFORM 1 FROM public.thiet_bi tb WHERE (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'all' OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'placed' AND btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn') OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'regular' AND btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn')) LIMIT 1;
    v_role := lower(coalesce(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_user_id := nullif(public._get_jwt_claim('user_id'), '');
  v_is_global := v_role IN ('global', 'admin');

  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim in JWT' USING errcode = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim in JWT' USING errcode = '42501';
  END IF;

  IF v_is_global THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL;
    END IF;
  ELSE
    v_allowed := public.allowed_don_vi_for_session_safe();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN jsonb_build_object(
        'summary', jsonb_build_object(
          'totalRepairs', 0,
          'repairCompletionRate', 0,
          'totalMaintenancePlanned', 0,
          'maintenanceCompletionRate', 0,
          'totalRepairCost', 0,
          'averageCompletedRepairCost', 0,
          'costRecordedCount', 0,
          'costMissingCount', 0
        ),
        'charts', jsonb_build_object(
          'repairStatusDistribution', '[]'::jsonb,
          'maintenancePlanVsActual', '[]'::jsonb,
          'repairFrequencyByMonth', '[]'::jsonb,
          'repairCostByMonth', '[]'::jsonb,
          'repairCostByFacility', '[]'::jsonb,
          'repairCompletionTime', jsonb_build_object(
            'stats', jsonb_build_object(
              'totalCompleted', 0,
              'medianMinutes', 0,
              'averageMinutes', 0,
              'p90Minutes', 0,
              'onTimeCount', 0,
              'onTimePercent', 0,
              'thresholdDays', 14
            ),
            'distribution', jsonb_build_array(
              jsonb_build_object('bucketKey', '0-1d', 'label', '0-1 ngày', 'count', 0, 'isOverThreshold', false),
              jsonb_build_object('bucketKey', '1-3d', 'label', '1-3 ngày', 'count', 0, 'isOverThreshold', false),
              jsonb_build_object('bucketKey', '3-7d', 'label', '3-7 ngày', 'count', 0, 'isOverThreshold', false),
              jsonb_build_object('bucketKey', '7-14d', 'label', '7-14 ngày', 'count', 0, 'isOverThreshold', false),
              jsonb_build_object('bucketKey', '14-30d', 'label', '14-30 ngày', 'count', 0, 'isOverThreshold', true),
              jsonb_build_object('bucketKey', '30d+', 'label', '>30 ngày', 'count', 0, 'isOverThreshold', true)
            )
          ),
          'repairCompletionTimeByMonth', '[]'::jsonb,
          'repairUsageCostCorrelation', jsonb_build_object(
            'period', jsonb_build_object(
              'points', '[]'::jsonb,
              'dataQuality', jsonb_build_object(
                'equipmentWithUsage', 0,
                'equipmentWithRepairCost', 0,
                'equipmentWithBoth', 0
              )
            ),
            'cumulative', jsonb_build_object(
              'points', '[]'::jsonb,
              'dataQuality', jsonb_build_object(
                'equipmentWithUsage', 0,
                'equipmentWithRepairCost', 0,
                'equipmentWithBoth', 0
              )
            )
          )
        ),
        'topEquipmentRepairs', '[]'::jsonb,
        'topEquipmentRepairCosts', '[]'::jsonb
      );
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF p_don_vi = ANY(v_allowed) THEN
        v_effective := ARRAY[p_don_vi];
      ELSE
        RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING errcode = '42501';
      END IF;
    ELSE
      v_effective := v_allowed;
    END IF;
  END IF;

  WITH scoped_equipment AS (
    SELECT
      tb.id AS equipment_id,
      coalesce(nullif(trim(tb.ten_thiet_bi), ''), tb.ma_thiet_bi, 'Không xác định') AS equipment_name,
      tb.ma_thiet_bi AS equipment_code,
      tb.don_vi AS facility_id
    FROM public.thiet_bi tb
    WHERE (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'all' OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'placed' AND btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn') OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'regular' AND btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn'))
      AND (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
  ),
  repair_data_raw AS (
    SELECT
      yc.id,
      yc.trang_thai,
      yc.mo_ta_su_co,
      yc.ngay_yeu_cau,
      yc.ngay_duyet,
      yc.ngay_hoan_thanh,
      yc.chi_phi_sua_chua,
      se.equipment_id,
      se.equipment_name,
      se.equipment_code,
      se.facility_id,
      coalesce(dv.name, 'Không xác định') AS facility_name,
      coalesce(yc.ngay_yeu_cau, yc.ngay_duyet, yc.ngay_hoan_thanh) AS reference_timestamp,
      (
        lower(coalesce(yc.trang_thai, '')) LIKE '%hoàn thành%'
        OR lower(coalesce(yc.trang_thai, '')) LIKE '%hoan thanh%'
      ) AS is_completed
    FROM public.yeu_cau_sua_chua yc
    INNER JOIN scoped_equipment se ON yc.thiet_bi_id = se.equipment_id
    LEFT JOIN public.don_vi dv ON dv.id = se.facility_id
  ),
  repair_data AS (
    SELECT
      id,
      trang_thai,
      mo_ta_su_co,
      ngay_yeu_cau,
      ngay_duyet,
      ngay_hoan_thanh,
      chi_phi_sua_chua,
      equipment_id,
      equipment_name,
      equipment_code,
      facility_id,
      facility_name,
      reference_timestamp,
      is_completed
    FROM repair_data_raw
    WHERE reference_timestamp IS NOT NULL
      AND (reference_timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')::date BETWEEN p_date_from AND p_date_to
  ),
  cumulative_repair_data AS (
    SELECT
      id,
      trang_thai,
      mo_ta_su_co,
      ngay_yeu_cau,
      ngay_duyet,
      ngay_hoan_thanh,
      chi_phi_sua_chua,
      equipment_id,
      equipment_name,
      equipment_code,
      facility_id,
      facility_name,
      reference_timestamp,
      is_completed
    FROM repair_data_raw
    WHERE reference_timestamp IS NOT NULL
      AND (reference_timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= p_date_to
  ),
  repair_summary AS (
    SELECT
      count(*) AS total_repairs,
      count(*) FILTER (WHERE is_completed) AS completed,
      count(*) FILTER (WHERE lower(coalesce(trang_thai, '')) LIKE '%không ht%') AS not_completed,
      count(*) FILTER (
        WHERE lower(coalesce(trang_thai, '')) LIKE '%đã duyệt%'
           OR lower(coalesce(trang_thai, '')) LIKE '%da duyet%'
      ) AS approved,
      count(*) FILTER (
        WHERE lower(coalesce(trang_thai, '')) LIKE '%chờ%'
           OR lower(coalesce(trang_thai, '')) LIKE '%cho%'
      ) AS pending,
      coalesce(sum(chi_phi_sua_chua) FILTER (WHERE is_completed), 0) AS total_repair_cost,
      avg(chi_phi_sua_chua) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NOT NULL) AS average_completed_repair_cost,
      count(*) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NOT NULL) AS cost_recorded_count,
      count(*) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NULL) AS cost_missing_count
    FROM repair_data
  ),
  maintenance_data AS (
    SELECT
      kh.id AS plan_id,
      kh.nam,
      kh.trang_thai,
      kh.don_vi,
      cv.id AS task_id,
      cv.loai_cong_viec,
      cv.thang_1,
      cv.thang_1_hoan_thanh,
      cv.thang_2,
      cv.thang_2_hoan_thanh,
      cv.thang_3,
      cv.thang_3_hoan_thanh,
      cv.thang_4,
      cv.thang_4_hoan_thanh,
      cv.thang_5,
      cv.thang_5_hoan_thanh,
      cv.thang_6,
      cv.thang_6_hoan_thanh,
      cv.thang_7,
      cv.thang_7_hoan_thanh,
      cv.thang_8,
      cv.thang_8_hoan_thanh,
      cv.thang_9,
      cv.thang_9_hoan_thanh,
      cv.thang_10,
      cv.thang_10_hoan_thanh,
      cv.thang_11,
      cv.thang_11_hoan_thanh,
      cv.thang_12,
      cv.thang_12_hoan_thanh
    FROM public.ke_hoach_bao_tri kh
    LEFT JOIN public.cong_viec_bao_tri cv ON kh.id = cv.ke_hoach_id
    WHERE (v_effective IS NULL OR kh.don_vi = ANY(v_effective))
      AND kh.nam BETWEEN v_from_year AND v_to_year
      AND kh.trang_thai = 'Đã duyệt'
  ),
  maintenance_summary AS (
    SELECT
      loai_cong_viec,
      (
        CASE WHEN thang_1 THEN 1 ELSE 0 END + CASE WHEN thang_2 THEN 1 ELSE 0 END +
        CASE WHEN thang_3 THEN 1 ELSE 0 END + CASE WHEN thang_4 THEN 1 ELSE 0 END +
        CASE WHEN thang_5 THEN 1 ELSE 0 END + CASE WHEN thang_6 THEN 1 ELSE 0 END +
        CASE WHEN thang_7 THEN 1 ELSE 0 END + CASE WHEN thang_8 THEN 1 ELSE 0 END +
        CASE WHEN thang_9 THEN 1 ELSE 0 END + CASE WHEN thang_10 THEN 1 ELSE 0 END +
        CASE WHEN thang_11 THEN 1 ELSE 0 END + CASE WHEN thang_12 THEN 1 ELSE 0 END
      ) AS planned,
      (
        CASE WHEN thang_1_hoan_thanh THEN 1 ELSE 0 END + CASE WHEN thang_2_hoan_thanh THEN 1 ELSE 0 END +
        CASE WHEN thang_3_hoan_thanh THEN 1 ELSE 0 END + CASE WHEN thang_4_hoan_thanh THEN 1 ELSE 0 END +
        CASE WHEN thang_5_hoan_thanh THEN 1 ELSE 0 END + CASE WHEN thang_6_hoan_thanh THEN 1 ELSE 0 END +
        CASE WHEN thang_7_hoan_thanh THEN 1 ELSE 0 END + CASE WHEN thang_8_hoan_thanh THEN 1 ELSE 0 END +
        CASE WHEN thang_9_hoan_thanh THEN 1 ELSE 0 END + CASE WHEN thang_10_hoan_thanh THEN 1 ELSE 0 END +
        CASE WHEN thang_11_hoan_thanh THEN 1 ELSE 0 END + CASE WHEN thang_12_hoan_thanh THEN 1 ELSE 0 END
      ) AS actual
    FROM maintenance_data
    WHERE loai_cong_viec IN ('Bảo trì', 'Hiệu chuẩn', 'Kiểm định')
  ),
  maintenance_aggregated AS (
    SELECT
      loai_cong_viec,
      sum(planned) AS total_planned,
      sum(actual) AS total_actual
    FROM maintenance_summary
    GROUP BY loai_cong_viec
  ),
  repair_frequency AS (
    SELECT
      to_char(date_trunc('month', reference_timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'), 'YYYY-MM') AS period,
      count(*)::integer AS total,
      count(*) FILTER (WHERE is_completed)::integer AS completed
    FROM repair_data
    GROUP BY date_trunc('month', reference_timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
  ),
  repair_cost_by_month AS (
    SELECT
      to_char(date_trunc('month', reference_timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'), 'YYYY-MM') AS period,
      coalesce(sum(chi_phi_sua_chua) FILTER (WHERE is_completed), 0) AS total_cost,
      avg(chi_phi_sua_chua) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NOT NULL) AS average_cost,
      count(*) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NOT NULL)::integer AS cost_recorded_count,
      count(*) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NULL)::integer AS cost_missing_count
    FROM repair_data
    GROUP BY date_trunc('month', reference_timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
  ),
  repair_cost_by_facility AS (
    SELECT
      facility_id,
      facility_name,
      coalesce(sum(chi_phi_sua_chua) FILTER (WHERE is_completed), 0) AS total_cost,
      avg(chi_phi_sua_chua) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NOT NULL) AS average_cost,
      count(*) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NOT NULL)::integer AS cost_recorded_count,
      count(*) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NULL)::integer AS cost_missing_count
    FROM repair_data
    GROUP BY facility_id, facility_name
  ),
  repair_completion_rows AS (
    SELECT
      id,
      ngay_hoan_thanh,
      extract(epoch from (ngay_hoan_thanh - ngay_yeu_cau)) / 60.0 AS completion_minutes
    FROM repair_data_raw
    WHERE is_completed
      AND ngay_hoan_thanh IS NOT NULL
      AND ngay_yeu_cau IS NOT NULL
      AND ngay_hoan_thanh >= ngay_yeu_cau
      AND (ngay_hoan_thanh AT TIME ZONE 'Asia/Ho_Chi_Minh')::date BETWEEN p_date_from AND p_date_to
  ),
  repair_completion_stats AS (
    SELECT
      count(*)::integer AS total_completed,
      round(coalesce(percentile_cont(0.5) WITHIN GROUP (ORDER BY completion_minutes), 0)::numeric, 1) AS median_minutes,
      round(coalesce(avg(completion_minutes), 0)::numeric, 1) AS average_minutes,
      round(coalesce(percentile_cont(0.9) WITHIN GROUP (ORDER BY completion_minutes), 0)::numeric, 1) AS p90_minutes,
      count(*) FILTER (WHERE completion_minutes <= 14 * 24 * 60)::integer AS on_time_count,
      CASE
        WHEN count(*) > 0 THEN round((count(*) FILTER (WHERE completion_minutes <= 14 * 24 * 60)::numeric / count(*)::numeric) * 100, 1)
        ELSE 0
      END AS on_time_percent
    FROM repair_completion_rows
  ),
  repair_completion_bucket_template AS (
    SELECT *
    FROM (
      VALUES
        (1, '0-1d', '0-1 ngày', 0::numeric, 1::numeric * 24 * 60, false),
        (2, '1-3d', '1-3 ngày', 1::numeric * 24 * 60, 3::numeric * 24 * 60, false),
        (3, '3-7d', '3-7 ngày', 3::numeric * 24 * 60, 7::numeric * 24 * 60, false),
        (4, '7-14d', '7-14 ngày', 7::numeric * 24 * 60, 14::numeric * 24 * 60, false),
        (5, '14-30d', '14-30 ngày', 14::numeric * 24 * 60, 30::numeric * 24 * 60, true),
        (6, '30d+', '>30 ngày', 30::numeric * 24 * 60, NULL::numeric, true)
    ) AS bucket(sort_order, bucket_key, bucket_label, min_minutes, max_minutes, is_over_threshold)
  ),
  repair_completion_distribution AS (
    SELECT
      bt.sort_order,
      bt.bucket_key,
      bt.bucket_label,
      bt.is_over_threshold,
      count(rcr.id)::integer AS bucket_count
    FROM repair_completion_bucket_template bt
    LEFT JOIN repair_completion_rows rcr
      ON (
        (bt.max_minutes IS NULL AND rcr.completion_minutes > bt.min_minutes)
        OR (bt.sort_order = 1 AND rcr.completion_minutes >= bt.min_minutes AND rcr.completion_minutes < bt.max_minutes)
        OR (bt.sort_order BETWEEN 2 AND 3 AND rcr.completion_minutes >= bt.min_minutes AND rcr.completion_minutes < bt.max_minutes)
        OR (bt.sort_order = 4 AND rcr.completion_minutes >= bt.min_minutes AND rcr.completion_minutes <= bt.max_minutes)
        OR (bt.sort_order = 5 AND rcr.completion_minutes > bt.min_minutes AND rcr.completion_minutes <= bt.max_minutes)
      )
    GROUP BY bt.sort_order, bt.bucket_key, bt.bucket_label, bt.is_over_threshold
  ),
  repair_completion_by_month AS (
    SELECT
      to_char(date_trunc('month', ngay_hoan_thanh AT TIME ZONE 'Asia/Ho_Chi_Minh'), 'YYYY-MM') AS period,
      round((percentile_cont(0.5) WITHIN GROUP (ORDER BY completion_minutes))::numeric, 1) AS median_minutes,
      round((percentile_cont(0.9) WITHIN GROUP (ORDER BY completion_minutes))::numeric, 1) AS p90_minutes,
      round(avg(completion_minutes)::numeric, 1) AS average_minutes,
      count(*)::integer AS completed_count
    FROM repair_completion_rows
    GROUP BY date_trunc('month', ngay_hoan_thanh AT TIME ZONE 'Asia/Ho_Chi_Minh')
  ),
  equipment_repairs AS (
    SELECT
      equipment_id,
      equipment_name,
      equipment_code,
      count(*)::integer AS total_requests,
      max(reference_timestamp) AS latest_event_at,
      max(ngay_hoan_thanh) AS latest_completed_at,
      coalesce(sum(chi_phi_sua_chua) FILTER (WHERE is_completed), 0) AS total_repair_cost,
      avg(chi_phi_sua_chua) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NOT NULL) AS average_completed_repair_cost,
      count(*) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NOT NULL)::integer AS cost_recorded_count,
      count(*) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NULL)::integer AS cost_missing_count
    FROM repair_data
    GROUP BY equipment_id, equipment_name, equipment_code
  ),
  equipment_latest_status AS (
    SELECT DISTINCT ON (equipment_id)
      equipment_id,
      coalesce(trang_thai, 'Không xác định') AS latest_status,
      coalesce(ngay_hoan_thanh, ngay_duyet, ngay_yeu_cau, reference_timestamp) AS status_timestamp
    FROM repair_data
    ORDER BY equipment_id, coalesce(ngay_hoan_thanh, ngay_duyet, ngay_yeu_cau, reference_timestamp) DESC
  ),
  top_equipment AS (
    SELECT
      er.equipment_id,
      er.equipment_name,
      er.equipment_code,
      er.total_requests,
      er.total_repair_cost,
      er.average_completed_repair_cost,
      er.cost_recorded_count,
      er.cost_missing_count,
      els.latest_status,
      CASE
        WHEN er.latest_completed_at IS NOT NULL THEN to_char(er.latest_completed_at, 'YYYY-MM-DD"T"HH24:MI:SS')
        ELSE NULL
      END AS latest_completed_date
    FROM equipment_repairs er
    LEFT JOIN equipment_latest_status els ON els.equipment_id = er.equipment_id
    ORDER BY er.total_requests DESC, er.equipment_name
    LIMIT 10
  ),
  usage_data_raw AS (
    SELECT
      se.equipment_id,
      se.equipment_name,
      se.equipment_code,
      nk.thoi_gian_bat_dau,
      nk.thoi_gian_ket_thuc,
      extract(epoch from (nk.thoi_gian_ket_thuc - nk.thoi_gian_bat_dau)) / 3600.0 AS usage_hours
    FROM scoped_equipment se
    INNER JOIN public.nhat_ky_su_dung nk
      ON nk.thiet_bi_id = se.equipment_id
    WHERE nk.thoi_gian_ket_thuc IS NOT NULL
      AND nk.thoi_gian_ket_thuc > nk.thoi_gian_bat_dau
  ),
  period_usage_by_equipment AS (
    SELECT
      equipment_id,
      equipment_name,
      equipment_code,
      sum(usage_hours) AS total_usage_hours
    FROM usage_data_raw
    WHERE (thoi_gian_bat_dau AT TIME ZONE 'Asia/Ho_Chi_Minh')::date BETWEEN p_date_from AND p_date_to
      AND (thoi_gian_ket_thuc AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= p_date_to
    GROUP BY equipment_id, equipment_name, equipment_code
  ),
  cumulative_usage_by_equipment AS (
    SELECT
      equipment_id,
      equipment_name,
      equipment_code,
      sum(usage_hours) AS total_usage_hours
    FROM usage_data_raw
    WHERE (thoi_gian_bat_dau AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= p_date_to
      AND (thoi_gian_ket_thuc AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= p_date_to
    GROUP BY equipment_id, equipment_name, equipment_code
  ),
  period_repair_costs_by_equipment AS (
    SELECT
      equipment_id,
      equipment_name,
      equipment_code,
      coalesce(sum(chi_phi_sua_chua) FILTER (WHERE is_completed), 0) AS total_repair_cost,
      avg(chi_phi_sua_chua) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NOT NULL) AS average_completed_repair_cost,
      count(*) FILTER (WHERE is_completed)::integer AS completed_repair_requests,
      count(*) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NOT NULL)::integer AS cost_recorded_count
    FROM repair_data
    GROUP BY equipment_id, equipment_name, equipment_code
  ),
  cumulative_repair_costs_by_equipment AS (
    SELECT
      equipment_id,
      equipment_name,
      equipment_code,
      coalesce(sum(chi_phi_sua_chua) FILTER (WHERE is_completed), 0) AS total_repair_cost,
      avg(chi_phi_sua_chua) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NOT NULL) AS average_completed_repair_cost,
      count(*) FILTER (WHERE is_completed)::integer AS completed_repair_requests,
      count(*) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NOT NULL)::integer AS cost_recorded_count
    FROM cumulative_repair_data
    GROUP BY equipment_id, equipment_name, equipment_code
  ),
  top_equipment_repair_costs AS (
    SELECT
      equipment_id,
      equipment_name,
      equipment_code,
      total_repair_cost,
      average_completed_repair_cost,
      completed_repair_requests,
      cost_recorded_count
    FROM period_repair_costs_by_equipment
    WHERE cost_recorded_count > 0
    ORDER BY total_repair_cost DESC, equipment_name
    LIMIT 10
  ),
  period_correlation_points AS (
    SELECT
      pu.equipment_id,
      pu.equipment_name,
      pu.equipment_code,
      pu.total_usage_hours,
      pr.total_repair_cost,
      pr.completed_repair_requests,
      pr.cost_recorded_count
    FROM period_usage_by_equipment pu
    INNER JOIN period_repair_costs_by_equipment pr ON pr.equipment_id = pu.equipment_id
    WHERE pu.total_usage_hours > 0
      AND pr.cost_recorded_count > 0
  ),
  cumulative_correlation_points AS (
    SELECT
      cu.equipment_id,
      cu.equipment_name,
      cu.equipment_code,
      cu.total_usage_hours,
      cr.total_repair_cost,
      cr.completed_repair_requests,
      cr.cost_recorded_count
    FROM cumulative_usage_by_equipment cu
    INNER JOIN cumulative_repair_costs_by_equipment cr ON cr.equipment_id = cu.equipment_id
    WHERE cu.total_usage_hours > 0
      AND cr.cost_recorded_count > 0
  ),
  period_correlation_data_quality AS (
    SELECT
      (SELECT count(*)::integer FROM period_usage_by_equipment WHERE total_usage_hours > 0) AS equipment_with_usage,
      (SELECT count(*)::integer FROM period_repair_costs_by_equipment WHERE cost_recorded_count > 0) AS equipment_with_repair_cost,
      (SELECT count(*)::integer FROM period_correlation_points) AS equipment_with_both
  ),
  cumulative_correlation_data_quality AS (
    SELECT
      (SELECT count(*)::integer FROM cumulative_usage_by_equipment WHERE total_usage_hours > 0) AS equipment_with_usage,
      (SELECT count(*)::integer FROM cumulative_repair_costs_by_equipment WHERE cost_recorded_count > 0) AS equipment_with_repair_cost,
      (SELECT count(*)::integer FROM cumulative_correlation_points) AS equipment_with_both
  )
  SELECT jsonb_build_object(
    'summary', (
      SELECT jsonb_build_object(
        'totalRepairs', coalesce(rs.total_repairs, 0),
        'repairCompletionRate',
          CASE
            WHEN coalesce(rs.total_repairs, 0) > 0
              THEN (coalesce(rs.completed, 0)::numeric / rs.total_repairs * 100)
            ELSE 0
          END,
        'totalMaintenancePlanned', coalesce((SELECT sum(ma.total_planned) FROM maintenance_aggregated ma), 0),
        'maintenanceCompletionRate',
          CASE
            WHEN coalesce((SELECT sum(ma.total_planned) FROM maintenance_aggregated ma), 0) > 0 THEN
              (
                coalesce((SELECT sum(ma.total_actual) FROM maintenance_aggregated ma), 0)::numeric /
                (SELECT sum(ma.total_planned) FROM maintenance_aggregated ma) * 100
              )
            ELSE 0
          END,
        'totalRepairCost', coalesce(rs.total_repair_cost, 0),
        'averageCompletedRepairCost', coalesce(rs.average_completed_repair_cost, 0),
        'costRecordedCount', coalesce(rs.cost_recorded_count, 0),
        'costMissingCount', coalesce(rs.cost_missing_count, 0)
      )
      FROM repair_summary rs
    ),
    'charts', jsonb_build_object(
      'repairStatusDistribution', (
        SELECT coalesce(
          jsonb_agg(
            jsonb_build_object(
              'name', status_name,
              'value', status_count,
              'color', status_color
            )
          ),
          '[]'::jsonb
        )
        FROM (
          SELECT 'Hoàn thành' AS status_name, completed AS status_count, 'hsl(var(--chart-1))' AS status_color
          FROM repair_summary
          WHERE completed > 0
          UNION ALL
          SELECT 'Không HT', not_completed, 'hsl(var(--chart-5))'
          FROM repair_summary
          WHERE not_completed > 0
          UNION ALL
          SELECT 'Đã duyệt', approved, 'hsl(var(--chart-2))'
          FROM repair_summary
          WHERE approved > 0
          UNION ALL
          SELECT 'Chờ xử lý', pending, 'hsl(var(--chart-3))'
          FROM repair_summary
          WHERE pending > 0
        ) statuses
      ),
      'maintenancePlanVsActual', (
        SELECT coalesce(
          jsonb_agg(
            jsonb_build_object(
              'name', loai_cong_viec,
              'planned', total_planned,
              'actual', total_actual
            )
            ORDER BY loai_cong_viec
          ),
          '[]'::jsonb
        )
        FROM maintenance_aggregated
      ),
      'repairFrequencyByMonth', (
        SELECT coalesce(
          jsonb_agg(
            jsonb_build_object(
              'period', period,
              'total', total,
              'completed', completed
            )
            ORDER BY period
          ),
          '[]'::jsonb
        )
        FROM repair_frequency
      ),
      'repairCostByMonth', (
        SELECT coalesce(
          jsonb_agg(
            jsonb_build_object(
              'period', period,
              'totalCost', total_cost,
              'averageCost', coalesce(average_cost, 0),
              'costRecordedCount', cost_recorded_count,
              'costMissingCount', cost_missing_count
            )
            ORDER BY period
          ),
          '[]'::jsonb
        )
        FROM repair_cost_by_month
      ),
      'repairCostByFacility', (
        SELECT coalesce(
          jsonb_agg(
            jsonb_build_object(
              'facilityId', facility_id,
              'facilityName', facility_name,
              'totalCost', total_cost,
              'averageCost', coalesce(average_cost, 0),
              'costRecordedCount', cost_recorded_count,
              'costMissingCount', cost_missing_count
            )
            ORDER BY facility_name
          ),
          '[]'::jsonb
        )
        FROM repair_cost_by_facility
      ),
      'repairCompletionTime', jsonb_build_object(
        'stats', (
          SELECT jsonb_build_object(
            'totalCompleted', coalesce(rcs.total_completed, 0),
            'medianMinutes', coalesce(rcs.median_minutes, 0),
            'averageMinutes', coalesce(rcs.average_minutes, 0),
            'p90Minutes', coalesce(rcs.p90_minutes, 0),
            'onTimeCount', coalesce(rcs.on_time_count, 0),
            'onTimePercent', coalesce(rcs.on_time_percent, 0),
            'thresholdDays', 14
          )
          FROM repair_completion_stats rcs
        ),
        'distribution', (
          SELECT coalesce(
            jsonb_agg(
              jsonb_build_object(
                'bucketKey', rcd.bucket_key,
                'label', rcd.bucket_label,
                'count', rcd.bucket_count,
                'isOverThreshold', rcd.is_over_threshold
              )
              ORDER BY rcd.sort_order
            ),
            '[]'::jsonb
          )
          FROM repair_completion_distribution rcd
        )
      ),
      'repairCompletionTimeByMonth', (
        SELECT coalesce(
          jsonb_agg(
            jsonb_build_object(
              'period', rcbm.period,
              'medianMinutes', rcbm.median_minutes,
              'p90Minutes', rcbm.p90_minutes,
              'averageMinutes', rcbm.average_minutes,
              'completedCount', rcbm.completed_count
            )
            ORDER BY rcbm.period
          ),
          '[]'::jsonb
        )
        FROM repair_completion_by_month rcbm
      ),
      'repairUsageCostCorrelation', jsonb_build_object(
        'period', jsonb_build_object(
          'points', (
            SELECT coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'equipmentId', pcp.equipment_id,
                  'equipmentName', pcp.equipment_name,
                  'equipmentCode', pcp.equipment_code,
                  'totalUsageHours', pcp.total_usage_hours,
                  'totalRepairCost', pcp.total_repair_cost,
                  'completedRepairRequests', pcp.completed_repair_requests,
                  'costRecordedCount', pcp.cost_recorded_count
                )
                ORDER BY pcp.total_repair_cost DESC, pcp.equipment_name
              ),
              '[]'::jsonb
            )
            FROM period_correlation_points pcp
          ),
          'dataQuality', (
            SELECT jsonb_build_object(
              'equipmentWithUsage', coalesce(pcq.equipment_with_usage, 0),
              'equipmentWithRepairCost', coalesce(pcq.equipment_with_repair_cost, 0),
              'equipmentWithBoth', coalesce(pcq.equipment_with_both, 0)
            )
            FROM period_correlation_data_quality pcq
          )
        ),
        'cumulative', jsonb_build_object(
          'points', (
            SELECT coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'equipmentId', ccp.equipment_id,
                  'equipmentName', ccp.equipment_name,
                  'equipmentCode', ccp.equipment_code,
                  'totalUsageHours', ccp.total_usage_hours,
                  'totalRepairCost', ccp.total_repair_cost,
                  'completedRepairRequests', ccp.completed_repair_requests,
                  'costRecordedCount', ccp.cost_recorded_count
                )
                ORDER BY ccp.total_repair_cost DESC, ccp.equipment_name
              ),
              '[]'::jsonb
            )
            FROM cumulative_correlation_points ccp
          ),
          'dataQuality', (
            SELECT jsonb_build_object(
              'equipmentWithUsage', coalesce(ccq.equipment_with_usage, 0),
              'equipmentWithRepairCost', coalesce(ccq.equipment_with_repair_cost, 0),
              'equipmentWithBoth', coalesce(ccq.equipment_with_both, 0)
            )
            FROM cumulative_correlation_data_quality ccq
          )
        )
      )
    ),
    'topEquipmentRepairs', (
      SELECT coalesce(
        jsonb_agg(
          jsonb_build_object(
            'equipmentId', te.equipment_id,
            'equipmentName', te.equipment_name,
            'totalRequests', te.total_requests,
            'latestStatus', coalesce(te.latest_status, 'Không xác định'),
            'latestCompletedDate', te.latest_completed_date,
            'totalRepairCost', te.total_repair_cost,
            'averageCompletedRepairCost', coalesce(te.average_completed_repair_cost, 0),
            'costRecordedCount', te.cost_recorded_count,
            'costMissingCount', te.cost_missing_count
          )
          ORDER BY te.total_requests DESC, te.equipment_name
        ),
        '[]'::jsonb
      )
      FROM top_equipment te
    ),
    'topEquipmentRepairCosts', (
      SELECT coalesce(
        jsonb_agg(
          jsonb_build_object(
            'equipmentId', terc.equipment_id,
            'equipmentName', terc.equipment_name,
            'equipmentCode', terc.equipment_code,
            'totalRepairCost', terc.total_repair_cost,
            'averageCompletedRepairCost', coalesce(terc.average_completed_repair_cost, 0),
            'completedRepairRequests', terc.completed_repair_requests,
            'costRecordedCount', terc.cost_recorded_count
          )
          ORDER BY terc.total_repair_cost DESC, terc.equipment_name
        ),
        '[]'::jsonb
      )
      FROM top_equipment_repair_costs terc
    )
  ) INTO v_result;

  RETURN coalesce(
    v_result,
    jsonb_build_object(
      'summary', jsonb_build_object(
        'totalRepairs', 0,
        'repairCompletionRate', 0,
        'totalMaintenancePlanned', 0,
        'maintenanceCompletionRate', 0,
        'totalRepairCost', 0,
        'averageCompletedRepairCost', 0,
        'costRecordedCount', 0,
        'costMissingCount', 0
      ),
      'charts', jsonb_build_object(
        'repairStatusDistribution', '[]'::jsonb,
        'maintenancePlanVsActual', '[]'::jsonb,
        'repairFrequencyByMonth', '[]'::jsonb,
        'repairCostByMonth', '[]'::jsonb,
        'repairCostByFacility', '[]'::jsonb,
        'repairCompletionTime', jsonb_build_object(
          'stats', jsonb_build_object(
            'totalCompleted', 0,
            'medianMinutes', 0,
            'averageMinutes', 0,
            'p90Minutes', 0,
            'onTimeCount', 0,
            'onTimePercent', 0,
            'thresholdDays', 14
          ),
          'distribution', jsonb_build_array(
            jsonb_build_object('bucketKey', '0-1d', 'label', '0-1 ngày', 'count', 0, 'isOverThreshold', false),
            jsonb_build_object('bucketKey', '1-3d', 'label', '1-3 ngày', 'count', 0, 'isOverThreshold', false),
            jsonb_build_object('bucketKey', '3-7d', 'label', '3-7 ngày', 'count', 0, 'isOverThreshold', false),
            jsonb_build_object('bucketKey', '7-14d', 'label', '7-14 ngày', 'count', 0, 'isOverThreshold', false),
            jsonb_build_object('bucketKey', '14-30d', 'label', '14-30 ngày', 'count', 0, 'isOverThreshold', true),
            jsonb_build_object('bucketKey', '30d+', 'label', '>30 ngày', 'count', 0, 'isOverThreshold', true)
          )
        ),
        'repairCompletionTimeByMonth', '[]'::jsonb,
        'repairUsageCostCorrelation', jsonb_build_object(
          'period', jsonb_build_object(
            'points', '[]'::jsonb,
            'dataQuality', jsonb_build_object(
              'equipmentWithUsage', 0,
              'equipmentWithRepairCost', 0,
              'equipmentWithBoth', 0
            )
          ),
          'cumulative', jsonb_build_object(
            'points', '[]'::jsonb,
            'dataQuality', jsonb_build_object(
              'equipmentWithUsage', 0,
              'equipmentWithRepairCost', 0,
              'equipmentWithBoth', 0
            )
          )
        )
      ),
      'topEquipmentRepairs', '[]'::jsonb,
      'topEquipmentRepairCosts', '[]'::jsonb
    )
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.maintenance_stats_for_reports(p_date_from date, p_date_to date, p_don_vi bigint, p_khoa_phong text, p_equipment_dataset text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text := lower(coalesce(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_user_id text := nullif(public._get_jwt_claim('user_id'), '');
  v_is_global boolean := false;
  v_claim_donvi bigint := nullif(public._get_jwt_claim('don_vi'), '')::bigint;
  v_allowed bigint[];
  v_effective bigint[];
  v_from date := coalesce(p_date_from, current_date - interval '1 year');
  v_to date := coalesce(p_date_to, current_date);
  v_from_year integer := extract(year from v_from)::integer;
  v_to_year integer := extract(year from v_to)::integer;
  result jsonb;
BEGIN
  IF lower(btrim(coalesce(p_equipment_dataset, ''))) NOT IN ('all', 'regular', 'placed') THEN RAISE EXCEPTION 'Invalid equipment dataset: %', p_equipment_dataset USING ERRCODE = '22023'; END IF;
  PERFORM 1 FROM public.thiet_bi tb WHERE (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'all' OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'placed' AND btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn') OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'regular' AND btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn')) LIMIT 1;
    IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim in JWT' USING errcode = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim in JWT' USING errcode = '42501';
  END IF;

  v_is_global := v_role IN ('global', 'admin');

  IF v_is_global THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL;
    END IF;
  ELSIF v_role = 'regional_leader' THEN
    v_allowed := public.allowed_don_vi_for_session_safe();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      v_effective := ARRAY[]::bigint[];
    ELSIF p_don_vi IS NOT NULL THEN
      IF p_don_vi = ANY(v_allowed) THEN
        v_effective := ARRAY[p_don_vi];
      ELSE
        RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING errcode = '42501';
      END IF;
    ELSE
      v_effective := v_allowed;
    END IF;
  ELSE
    IF v_claim_donvi IS NULL THEN
      RAISE EXCEPTION 'Missing don_vi claim for non-global role %', v_role USING errcode = '42501';
    END IF;
    IF p_don_vi IS NOT NULL AND p_don_vi <> v_claim_donvi THEN
      RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING errcode = '42501';
    END IF;
    v_effective := ARRAY[v_claim_donvi];
  END IF;

  SELECT jsonb_build_object(
    'repair_summary', (
      SELECT jsonb_build_object(
        'total_requests', count(*),
        'completed', count(*) FILTER (
          WHERE lower(coalesce(yc.trang_thai, '')) LIKE '%hoàn thành%'
             OR lower(coalesce(yc.trang_thai, '')) LIKE '%hoan thanh%'
        ),
        'pending', count(*) FILTER (
          WHERE lower(coalesce(yc.trang_thai, '')) LIKE '%chờ%'
             OR lower(coalesce(yc.trang_thai, '')) LIKE '%cho%'
        ),
        'in_progress', count(*) FILTER (
          WHERE lower(coalesce(yc.trang_thai, '')) LIKE '%đã duyệt%'
             OR lower(coalesce(yc.trang_thai, '')) LIKE '%da duyet%'
        ),
        'total_cost', coalesce(sum(yc.chi_phi_sua_chua) FILTER (
          WHERE lower(coalesce(yc.trang_thai, '')) LIKE '%hoàn thành%'
             OR lower(coalesce(yc.trang_thai, '')) LIKE '%hoan thanh%'
        ), 0),
        'average_completed_cost', coalesce(avg(yc.chi_phi_sua_chua) FILTER (
          WHERE (lower(coalesce(yc.trang_thai, '')) LIKE '%hoàn thành%'
             OR lower(coalesce(yc.trang_thai, '')) LIKE '%hoan thanh%')
            AND yc.chi_phi_sua_chua IS NOT NULL
        ), 0),
        'cost_recorded_count', count(*) FILTER (
          WHERE (lower(coalesce(yc.trang_thai, '')) LIKE '%hoàn thành%'
             OR lower(coalesce(yc.trang_thai, '')) LIKE '%hoan thanh%')
            AND yc.chi_phi_sua_chua IS NOT NULL
        ),
        'cost_missing_count', count(*) FILTER (
          WHERE (lower(coalesce(yc.trang_thai, '')) LIKE '%hoàn thành%'
             OR lower(coalesce(yc.trang_thai, '')) LIKE '%hoan thanh%')
            AND yc.chi_phi_sua_chua IS NULL
        )
      )
      FROM public.yeu_cau_sua_chua yc
      LEFT JOIN public.thiet_bi tb ON yc.thiet_bi_id = tb.id
    WHERE (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'all' OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'placed' AND btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn') OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'regular' AND btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn'))
      AND (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
        AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
        AND coalesce(yc.ngay_yeu_cau, yc.ngay_duyet, yc.ngay_hoan_thanh) IS NOT NULL
        AND (coalesce(yc.ngay_yeu_cau, yc.ngay_duyet, yc.ngay_hoan_thanh) AT TIME ZONE 'Asia/Ho_Chi_Minh')::date BETWEEN v_from AND v_to
    ),
    'maintenance_summary', (
      SELECT jsonb_build_object(
        'total_plans', count(DISTINCT kh.id),
        'total_tasks', count(cv.id),
        'completed_tasks', count(*) FILTER (
          WHERE
            coalesce(cv.thang_1_hoan_thanh,false) OR coalesce(cv.thang_2_hoan_thanh,false) OR
            coalesce(cv.thang_3_hoan_thanh,false) OR coalesce(cv.thang_4_hoan_thanh,false) OR
            coalesce(cv.thang_5_hoan_thanh,false) OR coalesce(cv.thang_6_hoan_thanh,false) OR
            coalesce(cv.thang_7_hoan_thanh,false) OR coalesce(cv.thang_8_hoan_thanh,false) OR
            coalesce(cv.thang_9_hoan_thanh,false) OR coalesce(cv.thang_10_hoan_thanh,false) OR
            coalesce(cv.thang_11_hoan_thanh,false) OR coalesce(cv.thang_12_hoan_thanh,false) OR
            cv.ngay_hoan_thanh_1 IS NOT NULL OR cv.ngay_hoan_thanh_2 IS NOT NULL OR
            cv.ngay_hoan_thanh_3 IS NOT NULL OR cv.ngay_hoan_thanh_4 IS NOT NULL OR
            cv.ngay_hoan_thanh_5 IS NOT NULL OR cv.ngay_hoan_thanh_6 IS NOT NULL OR
            cv.ngay_hoan_thanh_7 IS NOT NULL OR cv.ngay_hoan_thanh_8 IS NOT NULL OR
            cv.ngay_hoan_thanh_9 IS NOT NULL OR cv.ngay_hoan_thanh_10 IS NOT NULL OR
            cv.ngay_hoan_thanh_11 IS NOT NULL OR cv.ngay_hoan_thanh_12 IS NOT NULL
        )
      )
      FROM public.ke_hoach_bao_tri kh
      LEFT JOIN public.cong_viec_bao_tri cv ON kh.id = cv.ke_hoach_id
      LEFT JOIN public.thiet_bi tb ON cv.thiet_bi_id = tb.id
    WHERE (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'all' OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'placed' AND btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn') OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'regular' AND btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn'))
      AND (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
        AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
        AND kh.nam BETWEEN v_from_year AND v_to_year
    )
  ) INTO result;

  RETURN coalesce(result, jsonb_build_object(
    'repair_summary', jsonb_build_object(
      'total_requests', 0,
      'completed', 0,
      'pending', 0,
      'in_progress', 0,
      'total_cost', 0,
      'average_completed_cost', 0,
      'cost_recorded_count', 0,
      'cost_missing_count', 0
    ),
    'maintenance_summary', jsonb_build_object(
      'total_plans', 0,
      'total_tasks', 0,
      'completed_tasks', 0
    )
  ));
END;
$function$;


CREATE OR REPLACE FUNCTION public.usage_analytics_daily(p_days integer, p_don_vi bigint, p_equipment_dataset text)
 RETURNS SETOF jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  v_effective BIGINT[] := NULL;
BEGIN
  IF lower(btrim(coalesce(p_equipment_dataset, ''))) NOT IN ('all', 'regular', 'placed') THEN
    RAISE EXCEPTION 'Invalid equipment dataset: %', p_equipment_dataset USING ERRCODE = '22023';
  END IF;
  IF v_role = 'global' THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL;
    END IF;
  ELSE
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN;
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF NOT p_don_vi = ANY(v_allowed) THEN
        RAISE EXCEPTION 'Access denied for tenant %', p_don_vi USING ERRCODE = '42501';
      END IF;
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := v_allowed;
    END IF;
  END IF;

  IF v_effective IS NOT NULL AND array_length(v_effective, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT to_jsonb(row) FROM (
    SELECT
      date_trunc('day', nk.thoi_gian_bat_dau)::date as date,
      COUNT(*) as session_count,
      COALESCE(SUM(
        CASE
          WHEN nk.thoi_gian_ket_thuc IS NOT NULL
          THEN EXTRACT(EPOCH FROM (nk.thoi_gian_ket_thuc - nk.thoi_gian_bat_dau)) / 60
          ELSE 0
        END
      ), 0)::int as total_usage_time,
      COUNT(DISTINCT nk.nguoi_su_dung_id) as unique_users,
      COUNT(DISTINCT nk.thiet_bi_id) as unique_equipment
    FROM public.nhat_ky_su_dung nk
    LEFT JOIN public.thiet_bi tb ON nk.thiet_bi_id = tb.id
    WHERE (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'all' OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'placed' AND btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn') OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'regular' AND btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn'))
      AND (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
      AND nk.thoi_gian_bat_dau >= CURRENT_DATE - INTERVAL '1 day' * p_days
    GROUP BY date_trunc('day', nk.thoi_gian_bat_dau)
    ORDER BY date DESC
  ) row;
END;
$function$;


CREATE OR REPLACE FUNCTION public.usage_analytics_overview(p_don_vi bigint, p_equipment_dataset text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  v_effective BIGINT[] := NULL;
  result JSONB;
BEGIN
  IF lower(btrim(coalesce(p_equipment_dataset, ''))) NOT IN ('all', 'regular', 'placed') THEN
    RAISE EXCEPTION 'Invalid equipment dataset: %', p_equipment_dataset USING ERRCODE = '22023';
  END IF;
  IF v_role = 'global' THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL;
    END IF;
  ELSE
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN jsonb_build_object(
        'total_sessions', 0,
        'active_sessions', 0,
        'total_usage_time', 0
      );
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF NOT p_don_vi = ANY(v_allowed) THEN
        RAISE EXCEPTION 'Access denied for tenant %', p_don_vi USING ERRCODE = '42501';
      END IF;
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := v_allowed;
    END IF;
  END IF;

  IF v_effective IS NOT NULL AND array_length(v_effective, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'total_sessions', 0,
      'active_sessions', 0,
      'total_usage_time', 0
    );
  END IF;

  SELECT jsonb_build_object(
    'total_sessions', COUNT(*),
    'active_sessions', COUNT(*) FILTER (WHERE nk.trang_thai = 'dang_su_dung'),
    'total_usage_time', COALESCE(SUM(
      CASE
        WHEN nk.thoi_gian_ket_thuc IS NOT NULL
        THEN EXTRACT(EPOCH FROM (nk.thoi_gian_ket_thuc - nk.thoi_gian_bat_dau)) / 60
        ELSE 0
      END
    ), 0)::int
  ) INTO result
  FROM public.nhat_ky_su_dung nk
  LEFT JOIN public.thiet_bi tb ON nk.thiet_bi_id = tb.id
  WHERE (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'all' OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'placed' AND btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn') OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'regular' AND btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn'))
    AND (v_effective IS NULL OR tb.don_vi = ANY(v_effective));

  RETURN COALESCE(result, jsonb_build_object(
    'total_sessions', 0,
    'active_sessions', 0,
    'total_usage_time', 0
  ));
END;
$function$;


CREATE OR REPLACE FUNCTION public.usage_log_list(p_thiet_bi_id bigint, p_trang_thai text, p_active_only boolean, p_started_from timestamp with time zone, p_started_to timestamp with time zone, p_limit integer, p_offset integer, p_don_vi bigint, p_equipment_dataset text)
 RETURNS SETOF jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_is_global BOOLEAN := false;
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  v_effective BIGINT[] := NULL;
  v_limit INT := GREATEST(p_limit, 1);
  v_offset INT := GREATEST(p_offset, 0);
BEGIN
  IF lower(btrim(coalesce(p_equipment_dataset, ''))) NOT IN ('all', 'regular', 'placed') THEN RAISE EXCEPTION 'Invalid equipment dataset: %', p_equipment_dataset USING ERRCODE = '22023'; END IF;
  PERFORM 1 FROM public.thiet_bi tb WHERE (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'all' OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'placed' AND btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn') OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'regular' AND btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn')) LIMIT 1;
    v_is_global := v_role IN ('global', 'admin');

  IF p_trang_thai IS NOT NULL AND p_trang_thai NOT IN ('dang_su_dung', 'hoan_thanh') THEN
    RAISE EXCEPTION 'Invalid status filter' USING ERRCODE = '22023';
  END IF;

  IF v_is_global THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    END IF;
  ELSE
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN;
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF NOT p_don_vi = ANY(v_allowed) THEN
        RAISE EXCEPTION 'Access denied for tenant %', p_don_vi USING ERRCODE = '42501';
      END IF;
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := v_allowed;
    END IF;
  END IF;

  RETURN QUERY
  SELECT jsonb_build_object(
    'id', nk.id,
    'thiet_bi_id', nk.thiet_bi_id,
    'nguoi_su_dung_id', nk.nguoi_su_dung_id,
    'thoi_gian_bat_dau', nk.thoi_gian_bat_dau,
    'thoi_gian_ket_thuc', nk.thoi_gian_ket_thuc,
    'tinh_trang_thiet_bi', nk.tinh_trang_thiet_bi,
    'tinh_trang_ban_dau', nk.tinh_trang_ban_dau,
    'tinh_trang_ket_thuc', nk.tinh_trang_ket_thuc,
    'ghi_chu', nk.ghi_chu,
    'trang_thai', nk.trang_thai,
    'created_at', nk.created_at,
    'updated_at', nk.updated_at,
    'equipment_is_deleted', tb.is_deleted,
    'thiet_bi', jsonb_build_object(
      'id', tb.id,
      'ma_thiet_bi', tb.ma_thiet_bi,
      'ten_thiet_bi', tb.ten_thiet_bi,
      'khoa_phong_quan_ly', tb.khoa_phong_quan_ly,
      'don_vi', tb.don_vi,
      'is_deleted', tb.is_deleted
    ),
    'nguoi_su_dung', CASE
      WHEN nv.id IS NOT NULL THEN jsonb_build_object(
        'id', nv.id,
        'full_name', nv.full_name,
        'khoa_phong', nv.khoa_phong
      )
      ELSE NULL
    END
  )
  FROM public.nhat_ky_su_dung nk
  LEFT JOIN public.thiet_bi tb ON tb.id = nk.thiet_bi_id
  LEFT JOIN public.nhan_vien nv ON nv.id = nk.nguoi_su_dung_id
    WHERE (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'all' OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'placed' AND btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn') OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'regular' AND btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn'))
      AND (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
    AND (p_thiet_bi_id IS NULL OR nk.thiet_bi_id = p_thiet_bi_id)
    AND (NOT p_active_only OR nk.trang_thai = 'dang_su_dung')
    AND (p_trang_thai IS NULL OR nk.trang_thai = p_trang_thai)
    AND (p_started_from IS NULL OR nk.thoi_gian_bat_dau >= p_started_from)
    AND (p_started_to IS NULL OR nk.thoi_gian_bat_dau <= p_started_to)
  ORDER BY nk.thoi_gian_bat_dau DESC
  OFFSET v_offset
  LIMIT v_limit;
END;
$function$;


CREATE OR REPLACE FUNCTION public.usage_log_list(p_q text, p_status text, p_page integer, p_page_size integer, p_date_from date, p_date_to date, p_don_vi bigint, p_equipment_dataset text)
 RETURNS SETOF jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_is_global BOOLEAN := false;
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  v_effective BIGINT[] := NULL;
  v_offset INT := GREATEST(p_page - 1, 0) * GREATEST(p_page_size, 1);
  v_sanitized_q TEXT := NULL;
BEGIN
  IF lower(btrim(coalesce(p_equipment_dataset, ''))) NOT IN ('all', 'regular', 'placed') THEN RAISE EXCEPTION 'Invalid equipment dataset: %', p_equipment_dataset USING ERRCODE = '22023'; END IF;
  PERFORM 1 FROM public.thiet_bi tb WHERE (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'all' OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'placed' AND btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn') OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'regular' AND btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn')) LIMIT 1;
    v_is_global := v_role IN ('global', 'admin');
  v_sanitized_q := public._sanitize_ilike_pattern(p_q);

  IF v_is_global THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL;
    END IF;
  ELSE
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN;
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF NOT p_don_vi = ANY(v_allowed) THEN
        RAISE EXCEPTION 'Access denied for tenant %', p_don_vi USING ERRCODE = '42501';
      END IF;
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := v_allowed;
    END IF;
  END IF;

  IF v_effective IS NOT NULL AND array_length(v_effective, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT to_jsonb(nk)
    || jsonb_build_object(
      'thiet_bi', to_jsonb(tb),
      'equipment_is_deleted', tb.is_deleted
    )
    || jsonb_build_object(
      'nguoi_su_dung',
      CASE
        WHEN u.id IS NOT NULL THEN jsonb_build_object(
          'id', u.id,
          'full_name', u.full_name,
          'khoa_phong', u.khoa_phong
        )
        ELSE NULL
      END
    )
  FROM public.nhat_ky_su_dung nk
  LEFT JOIN public.thiet_bi tb ON nk.thiet_bi_id = tb.id
  LEFT JOIN public.nhan_vien u ON nk.nguoi_su_dung_id = u.id
  WHERE (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'all' OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'placed' AND btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn') OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'regular' AND btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn'))
    AND (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
    AND (p_status IS NULL OR nk.trang_thai = p_status)
    AND (p_date_from IS NULL OR nk.thoi_gian_bat_dau::date >= p_date_from)
    AND (p_date_to IS NULL OR nk.thoi_gian_bat_dau::date <= p_date_to)
    AND (
      v_sanitized_q IS NULL OR
      tb.ten_thiet_bi ILIKE '%' || v_sanitized_q || '%' OR
      tb.ma_thiet_bi ILIKE '%' || v_sanitized_q || '%'
    )
  ORDER BY nk.thoi_gian_bat_dau DESC
  OFFSET v_offset
  LIMIT GREATEST(p_page_size, 1);
END;
$function$;


REVOKE ALL ON FUNCTION public.dashboard_kpi_summary(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_kpi_summary(text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.dashboard_equipment_total(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_equipment_total(text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.dashboard_maintenance_count(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_maintenance_count(text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.equipment_attention_list(integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.equipment_attention_list(integer,text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.equipment_attention_list_paginated(integer,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.equipment_attention_list_paginated(integer,integer,text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.usage_log_list(bigint,text,boolean,timestamptz,timestamptz,integer,integer,bigint,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.usage_log_list(bigint,text,boolean,timestamptz,timestamptz,integer,integer,bigint,text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.usage_log_list(text,text,integer,integer,date,date,bigint,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.usage_log_list(text,text,integer,integer,date,date,bigint,text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.usage_analytics_overview(bigint,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.usage_analytics_overview(bigint,text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.usage_analytics_daily(integer,bigint,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.usage_analytics_daily(integer,bigint,text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_maintenance_report_data(date,date,bigint,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_maintenance_report_data(date,date,bigint,text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.maintenance_stats_for_reports(date,date,bigint,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.maintenance_stats_for_reports(date,date,bigint,text,text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_facilities_with_equipment_count(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_facilities_with_equipment_count(text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.dinh_muc_compliance_summary(bigint,bigint,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dinh_muc_compliance_summary(bigint,bigint,text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.dinh_muc_compliance_detail(bigint,bigint,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dinh_muc_compliance_detail(bigint,bigint,text) TO authenticated, service_role;
