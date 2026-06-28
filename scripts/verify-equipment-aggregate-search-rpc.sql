begin;

do $$
declare
  v_region_a bigint := -627001;
  v_region_b bigint := -627002;
  v_fac_over bigint := -627101;
  v_fac_not_in_quota bigint := -627102;
  v_fac_no_quota bigint := -627103;
  v_fac_unassigned bigint := -627104;
  v_fac_below bigint := -627105;
  v_fac_within bigint := -627106;
  v_fac_no_region bigint := -627107;
  v_group_over bigint := -627201;
  v_group_not_in_quota bigint := -627202;
  v_group_other bigint := -627203;
  v_group_no_quota bigint := -627204;
  v_group_below bigint := -627205;
  v_group_within bigint := -627206;
  v_group_no_region bigint := -627207;
  v_qd_over bigint := -627301;
  v_qd_not_in_quota bigint := -627302;
  v_qd_unassigned bigint := -627303;
  v_qd_below bigint := -627304;
  v_qd_within bigint := -627305;
  v_result jsonb;
  v_rows jsonb;
  v_summary jsonb;
  v_row jsonb;
begin
  insert into public.dia_ban (id, ma_dia_ban, ten_dia_ban, active)
  values
    (v_region_a, 'AGG-R-A-627', 'Aggregate Region A 627', true),
    (v_region_b, 'AGG-R-B-627', 'Aggregate Region B 627', true);

  insert into public.don_vi (id, code, name, active, dia_ban_id)
  values
    (v_fac_over, 'AGG-F-OVER-627', 'Aggregate Facility Over 627', true, v_region_a),
    (v_fac_not_in_quota, 'AGG-F-NOT-IN-627', 'Aggregate Facility Not In Quota 627', true, v_region_a),
    (v_fac_no_quota, 'AGG-F-NO-QUOTA-627', 'Aggregate Facility No Quota 627', true, v_region_b),
    (v_fac_unassigned, 'AGG-F-UNASSIGNED-627', 'Aggregate Facility Unassigned 627', true, v_region_b),
    (v_fac_below, 'AGG-F-BELOW-627', 'Aggregate Facility Below 627', true, v_region_b),
    (v_fac_within, 'AGG-F-WITHIN-627', 'Aggregate Facility Within 627', true, v_region_b),
    (v_fac_no_region, 'AGG-F-NO-REGION-627', 'Aggregate Facility No Region 627', true, null);

  insert into public.nhom_thiet_bi (id, don_vi_id, ma_nhom, ten_nhom)
  values
    (v_group_over, v_fac_over, 'AGG-G-OVER-627', 'Aggregate Pump Group 627'),
    (v_group_not_in_quota, v_fac_not_in_quota, 'AGG-G-NOT-IN-627', 'Aggregate Serial Group 627'),
    (v_group_other, v_fac_not_in_quota, 'AGG-G-OTHER-627', 'Aggregate Other Group 627'),
    (v_group_no_quota, v_fac_no_quota, 'AGG-G-NO-QUOTA-627', 'Aggregate Category Group 627'),
    (v_group_below, v_fac_below, 'AGG-G-BELOW-627', 'Aggregate Below Group 627'),
    (v_group_within, v_fac_within, 'AGG-G-WITHIN-627', 'Aggregate Within Group 627'),
    (v_group_no_region, v_fac_no_region, 'AGG-G-NO-REGION-627', 'Aggregate No Region Group 627');

  insert into public.quyet_dinh_dinh_muc
    (id, don_vi_id, so_quyet_dinh, ngay_ban_hanh, ngay_hieu_luc, nguoi_ky, chuc_vu_nguoi_ky, trang_thai)
  values
    (v_qd_over, v_fac_over, 'AGG-QD-OVER-627', current_date, current_date, 'Tester', 'Tester', 'active'),
    (v_qd_not_in_quota, v_fac_not_in_quota, 'AGG-QD-NOT-IN-627', current_date, current_date, 'Tester', 'Tester', 'active'),
    (v_qd_unassigned, v_fac_unassigned, 'AGG-QD-UNASSIGNED-627', current_date, current_date, 'Tester', 'Tester', 'active'),
    (v_qd_below, v_fac_below, 'AGG-QD-BELOW-627', current_date, current_date, 'Tester', 'Tester', 'active'),
    (v_qd_within, v_fac_within, 'AGG-QD-WITHIN-627', current_date, current_date, 'Tester', 'Tester', 'active');

  insert into public.chi_tiet_dinh_muc
    (quyet_dinh_id, nhom_thiet_bi_id, so_luong_toi_da, so_luong_toi_thieu)
  values
    (v_qd_over, v_group_over, 1, 0),
    (v_qd_not_in_quota, v_group_other, 5, 0),
    (v_qd_below, v_group_below, 5, 2),
    (v_qd_within, v_group_within, 2, 1);

  insert into public.thiet_bi
    (id, ma_thiet_bi, ten_thiet_bi, model, serial, don_vi, nhom_thiet_bi_id, is_deleted)
  values
    (-627401, 'AGG-CODE-ONLY-627', 'Aggregate Alpha Pump 627', 'AGG-MODEL-627', 'AGG-SERIAL-OVER-627', v_fac_over, v_group_over, false),
    (-627402, 'AGG-CODE-SECOND-627', 'Aggregate Alpha Pump 627 Second', 'AGG-MODEL-627-B', 'AGG-SERIAL-OVER-627-B', v_fac_over, v_group_over, false),
    (-627403, 'AGG-CODE-NOT-IN-627', 'Not In Quota Equipment 627', 'OTHER-MODEL-627', 'AGG-SERIAL-NOT-IN-627', v_fac_not_in_quota, v_group_not_in_quota, false),
    (-627404, 'AGG-CODE-NO-QUOTA-627', 'Category Field Equipment 627', 'OTHER-MODEL-627', 'OTHER-SERIAL-627', v_fac_no_quota, v_group_no_quota, false),
    (-627405, 'AGG-CODE-UNASSIGNED-627', 'Aggregate Unassigned Match 627', 'OTHER-MODEL-627', 'OTHER-SERIAL-627', v_fac_unassigned, null, false),
    (-627406, 'AGG-CODE-BELOW-627', 'Aggregate Below Match 627', 'OTHER-MODEL-627', 'OTHER-SERIAL-627', v_fac_below, v_group_below, false),
    (-627407, 'AGG-CODE-WITHIN-627', 'Aggregate Within Match 627', 'OTHER-MODEL-627', 'OTHER-SERIAL-627', v_fac_within, v_group_within, false),
    (-627408, 'AGG-CODE-ONLY-NEVER-MATCH-627', 'No Keyword Here', 'NO-MODEL-HERE', 'NO-SERIAL-HERE', v_fac_within, v_group_within, false),
    (-627409, 'AGG-CODE-NO-REGION-627', 'Aggregate No Region Match 627', 'OTHER-MODEL-627', 'OTHER-SERIAL-627', v_fac_no_region, v_group_no_region, false);

  perform set_config('request.jwt.claims', jsonb_build_object(
    'app_role', 'admin',
    'user_id', 'agg-admin-627'
  )::text, true);

  v_result := public.equipment_aggregate_search('AGG-MODEL-627', 'region', null, 10);
  v_rows := v_result -> 'rows';
  v_summary := v_result -> 'summary';
  if jsonb_array_length(v_rows) <> 1 then
    raise exception 'expected one region row for model match, got %', v_rows;
  end if;
  v_row := v_rows -> 0;
  if (v_row ->> 'groupType') <> 'region'
     or (v_row ->> 'groupId')::bigint <> v_region_a
     or (v_row ->> 'equipmentCount')::int <> 2
     or (v_row ->> 'facilityCount')::int <> 1 then
    raise exception 'unexpected region row for model match: %', v_row;
  end if;
  if (v_summary ->> 'totalEquipmentCount')::int <> 2
     or (v_summary ->> 'regionCount')::int <> 1
     or (v_summary ->> 'facilityCount')::int <> 1 then
    raise exception 'unexpected summary for model match: %', v_summary;
  end if;

  v_result := public.equipment_aggregate_search('AGG-CODE-ONLY-NEVER-MATCH-627', 'facility', null, 10);
  if jsonb_array_length(v_result -> 'rows') <> 0 then
    raise exception 'internal equipment code must not be a search predicate: %', v_result;
  end if;

  v_result := public.equipment_aggregate_search('Aggregate No Region Match 627', 'region', null, 10);
  v_rows := v_result -> 'rows';
  v_summary := v_result -> 'summary';
  if jsonb_array_length(v_rows) <> 1 then
    raise exception 'expected one no-region row, got %', v_rows;
  end if;
  v_row := v_rows -> 0;
  if (v_row ->> 'groupId') is not null
     or (v_row ->> 'groupName') <> 'Chưa phân vùng'
     or (v_summary ->> 'regionCount')::int <> 1 then
    raise exception 'expected no-region bucket counted in summary, got row %, summary %', v_row, v_summary;
  end if;

  v_result := public.equipment_aggregate_search('AGG-MODEL-627', 'facility', null, 10);
  v_rows := v_result -> 'rows';
  if jsonb_array_length(v_rows) <> 1 then
    raise exception 'expected one over-limit facility row, got %', v_rows;
  end if;
  v_row := v_rows -> 0;
  if (v_row ->> 'groupId')::bigint <> v_fac_over
     or (v_row ->> 'quotaStatus') <> 'over_limit'
     or (v_row ->> 'quotaCurrentCount')::int <> 2
     or (v_row ->> 'quotaMaxCount')::int <> 1 then
    raise exception 'expected over_limit quota context, got %', v_row;
  end if;

  v_result := public.equipment_aggregate_search('AGG-SERIAL-NOT-IN-627', 'facility', null, 10);
  v_rows := v_result -> 'rows';
  if jsonb_array_length(v_rows) <> 1 then
    raise exception 'expected one serial match row, got %', v_rows;
  end if;
  v_row := v_rows -> 0;
  if (v_row ->> 'groupId')::bigint <> v_fac_not_in_quota
     or (v_row ->> 'quotaStatus') <> 'not_in_unit_quota' then
    raise exception 'expected serial match with not_in_unit_quota, got %', v_row;
  end if;

  v_result := public.equipment_aggregate_search('Aggregate Category Group 627', 'facility', null, 10);
  v_rows := v_result -> 'rows';
  if jsonb_array_length(v_rows) <> 1 then
    raise exception 'expected one category match row, got %', v_rows;
  end if;
  v_row := v_rows -> 0;
  if (v_row ->> 'groupId')::bigint <> v_fac_no_quota
     or (v_row ->> 'quotaStatus') <> 'no_active_quota' then
    raise exception 'expected category match with no_active_quota, got %', v_row;
  end if;

  v_result := public.equipment_aggregate_search('Aggregate Unassigned Match 627', 'facility', null, 10);
  v_rows := v_result -> 'rows';
  if jsonb_array_length(v_rows) <> 1 then
    raise exception 'expected one unassigned match row, got %', v_rows;
  end if;
  v_row := v_rows -> 0;
  if (v_row ->> 'groupId')::bigint <> v_fac_unassigned
     or (v_row ->> 'quotaStatus') <> 'unassigned_category' then
    raise exception 'expected unassigned_category, got %', v_row;
  end if;

  v_result := public.equipment_aggregate_search('Aggregate Below Match 627', 'facility', null, 10);
  v_rows := v_result -> 'rows';
  if jsonb_array_length(v_rows) <> 1 then
    raise exception 'expected one below-minimum match row, got %', v_rows;
  end if;
  v_row := v_rows -> 0;
  if (v_row ->> 'quotaStatus') <> 'below_minimum'
     or (v_row ->> 'quotaCurrentCount')::int <> 1
     or (v_row ->> 'quotaMinCount')::int <> 2
     or (v_row ->> 'quotaMaxCount')::int <> 5 then
    raise exception 'expected below_minimum quota context, got %', v_row;
  end if;

  v_result := public.equipment_aggregate_search('Aggregate Within Match 627', 'facility', null, 10);
  v_rows := v_result -> 'rows';
  if jsonb_array_length(v_rows) <> 1 then
    raise exception 'expected one within-limit match row, got %', v_rows;
  end if;
  v_row := v_rows -> 0;
  if (v_row ->> 'quotaStatus') <> 'within_limit' then
    raise exception 'expected within_limit, got %', v_row;
  end if;

  perform set_config('request.jwt.claims', jsonb_build_object(
    'app_role', 'regional_leader',
    'user_id', 'agg-regional-627',
    'dia_ban', v_region_a
  )::text, true);

  v_result := public.equipment_aggregate_search('Aggregate', 'facility', v_region_b, 20);
  if jsonb_array_length(v_result -> 'rows') <> 0 then
    raise exception 'regional leader region param expanded scope: %', v_result;
  end if;

  v_result := public.equipment_aggregate_search('Aggregate', 'facility', v_region_a, 20);
  if exists (
    select 1
    from jsonb_array_elements(v_result -> 'rows') as row(value)
    where ((row.value ->> 'parentRegionId')::bigint) is distinct from v_region_a
  ) then
    raise exception 'regional leader leaked outside assigned region: %', v_result;
  end if;

  perform set_config('request.jwt.claims', jsonb_build_object(
    'app_role', 'user',
    'user_id', 'agg-user-627',
    'don_vi', v_fac_over
  )::text, true);

  begin
    perform public.equipment_aggregate_search('Aggregate', 'facility', null, 10);
    raise exception 'unsupported role user was not rejected';
  exception
    when insufficient_privilege then
      null;
  end;
end;
$$;

rollback;
