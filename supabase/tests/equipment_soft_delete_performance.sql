-- supabase/tests/equipment_soft_delete_performance.sql
-- Purpose: capture and gate performance for key equipment soft-delete read paths
-- Non-destructive: uses transaction + rollback

BEGIN;

CREATE TEMP TABLE perf_probe_results (
  phase text NOT NULL,
  probe text NOT NULL,
  planning_ms numeric NOT NULL,
  execution_ms numeric NOT NULL,
  shared_hit_blocks bigint,
  shared_read_blocks bigint,
  has_thiet_bi_seq_scan boolean NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT clock_timestamp()
) ON COMMIT DROP;

DO $$
DECLARE
  v_tenant bigint;
  v_tb_count bigint;
  v_phase text;
  v_probe_name text;
  v_probe_sql text;
  v_plan jsonb;
  v_regression text;
  v_seq_scan_issues text;
BEGIN
  SELECT tb.don_vi
  INTO v_tenant
  FROM public.thiet_bi tb
  WHERE tb.don_vi IS NOT NULL
  GROUP BY tb.don_vi
  ORDER BY COUNT(*) DESC, tb.don_vi
  LIMIT 1;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'No tenant found for performance probes';
  END IF;

  SELECT COUNT(*) INTO v_tb_count FROM public.thiet_bi;

  TRUNCATE TABLE perf_probe_results;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'global',
      'role', 'authenticated',
      'user_id', '1',
      'sub', '1',
      'don_vi', null
    )::text,
    true
  );

  FOR v_phase IN
    SELECT unnest(ARRAY['baseline_snapshot', 'post_change_snapshot'])
  LOOP
    FOR v_probe_name, v_probe_sql IN
      SELECT probe_name, probe_sql
      FROM (
        VALUES
          (
            'equipment_list_enhanced',
            format(
              $sql$
              SELECT *
              FROM public.equipment_list_enhanced(
                p_q => NULL,
                p_sort => 'id.asc',
                p_page => 1,
                p_page_size => 50,
                p_don_vi => %s,
                p_khoa_phong => NULL,
                p_khoa_phong_array => NULL,
                p_nguoi_su_dung => NULL,
                p_nguoi_su_dung_array => NULL,
                p_vi_tri_lap_dat => NULL,
                p_vi_tri_lap_dat_array => NULL,
                p_tinh_trang => NULL,
                p_tinh_trang_array => NULL,
                p_phan_loai => NULL,
                p_phan_loai_array => NULL,
                p_nguon_kinh_phi => NULL,
                p_nguon_kinh_phi_array => NULL
              )
              $sql$,
              v_tenant
            )
          ),
          (
            'equipment_count_enhanced',
            format(
              $sql$
              SELECT public.equipment_count_enhanced(
                p_statuses => NULL,
                p_q => NULL,
                p_don_vi => %s,
                p_khoa_phong => NULL
              )
              $sql$,
              v_tenant
            )
          ),
          (
            'get_facilities_with_equipment_count',
            'SELECT * FROM public.get_facilities_with_equipment_count()'
          ),
          (
            'equipment_list_for_reports',
            format(
              $sql$
              SELECT *
              FROM public.equipment_list_for_reports(
                p_q => NULL,
                p_sort => 'id.asc',
                p_page => 1,
                p_page_size => 50,
                p_don_vi => %s,
                p_khoa_phong => NULL
              )
              $sql$,
              v_tenant
            )
          )
      ) AS probes(probe_name, probe_sql)
    LOOP
      EXECUTE 'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ' || v_probe_sql
      INTO v_plan;

      INSERT INTO perf_probe_results (
        phase,
        probe,
        planning_ms,
        execution_ms,
        shared_hit_blocks,
        shared_read_blocks,
        has_thiet_bi_seq_scan
      )
      VALUES (
        v_phase,
        v_probe_name,
        COALESCE((v_plan->0->>'Planning Time')::numeric, 0),
        COALESCE((v_plan->0->>'Execution Time')::numeric, 0),
        (v_plan->0->'Plan'->>'Shared Hit Blocks')::bigint,
        (v_plan->0->'Plan'->>'Shared Read Blocks')::bigint,
        jsonb_path_exists(
          v_plan,
          '$.** ? (@."Node Type" == "Seq Scan" && @."Relation Name" == "thiet_bi")'
        )
      );
    END LOOP;
  END LOOP;

  SELECT string_agg(
           format(
             '%s (baseline=%.3fms, post=%.3fms)',
             probe,
             baseline_ms,
             post_ms
           ),
           '; '
         )
  INTO v_regression
  FROM (
    SELECT
      b.probe,
      b.execution_ms AS baseline_ms,
      p.execution_ms AS post_ms
    FROM perf_probe_results b
    JOIN perf_probe_results p
      ON p.probe = b.probe
     AND p.phase = 'post_change_snapshot'
    WHERE b.phase = 'baseline_snapshot'
      AND p.execution_ms > GREATEST((b.execution_ms * 1.25), (b.execution_ms + 10))
  ) AS regressions;

  IF v_regression IS NOT NULL THEN
    RAISE EXCEPTION 'Performance regression threshold exceeded: %', v_regression;
  END IF;

  IF v_tb_count >= 1000 THEN
    SELECT string_agg(probe, ', ')
    INTO v_seq_scan_issues
    FROM perf_probe_results
    WHERE phase = 'post_change_snapshot'
      AND probe IN (
        'equipment_list_enhanced',
        'equipment_count_enhanced',
        'equipment_list_for_reports'
      )
      AND has_thiet_bi_seq_scan;

    IF v_seq_scan_issues IS NOT NULL THEN
      RAISE EXCEPTION
        'Unexpected Seq Scan on thiet_bi for tenant-filtered probes: %',
        v_seq_scan_issues;
    END IF;
  ELSE
    RAISE NOTICE
      'Skipped strict seq-scan assertion because thiet_bi has only % rows',
      v_tb_count;
  END IF;

  RAISE NOTICE
    'OK: performance probes captured for tenant % (thiet_bi rows=%)',
    v_tenant,
    v_tb_count;
END $$;

SELECT
  phase,
  probe,
  planning_ms,
  execution_ms,
  shared_hit_blocks,
  shared_read_blocks,
  has_thiet_bi_seq_scan
FROM perf_probe_results
ORDER BY probe, phase;

ROLLBACK;
