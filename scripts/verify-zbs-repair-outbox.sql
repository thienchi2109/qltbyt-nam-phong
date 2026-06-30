begin;

do $$
declare
  v_fac_a bigint := -618101;
  v_fac_b bigint := -618102;
  v_fac_c bigint := -618103;
  v_tb_a bigint := -618201;
  v_tb_b bigint := -618202;
  v_tb_c bigint := -618203;
  v_req_a bigint;
  v_req_b bigint;
  v_req_c bigint;
  v_count int;
  v_phones text[];
  v_duplicate record;
begin
  if to_regclass('public.zbs_recipient_configs') is null then
    raise exception 'missing public.zbs_recipient_configs';
  end if;

  if to_regclass('public.zbs_notification_outbox') is null then
    raise exception 'missing public.zbs_notification_outbox';
  end if;

  if exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'yeu_cau_sua_chua'
      and t.tgname = 'on_repair_request_created'
      and t.tgenabled <> 'D'
      and not t.tgisinternal
  ) then
    raise exception 'legacy repair request push trigger must be disabled before ZBS outbox dispatch';
  end if;

  insert into public.don_vi (id, code, name, active)
  values
    (v_fac_a, 'ZBS-FAC-A-618', 'ZBS Facility A 618', true),
    (v_fac_b, 'ZBS-FAC-B-618', 'ZBS Facility B 618', true),
    (v_fac_c, 'ZBS-FAC-C-618', 'ZBS Facility C 618', true);

  insert into public.nhan_vien
    (id, username, password, full_name, role, don_vi, current_don_vi, is_active)
  values
    (618001, 'zbs-user-a-618', 'test-password', 'ZBS User A 618', 'to_qltb', v_fac_a, v_fac_a, true),
    (618002, 'zbs-user-b-618', 'test-password', 'ZBS User B 618', 'to_qltb', v_fac_b, v_fac_b, true),
    (618003, 'zbs-user-c-618', 'test-password', 'ZBS User C 618', 'to_qltb', v_fac_c, v_fac_c, true);

  insert into public.thiet_bi
    (id, ma_thiet_bi, ten_thiet_bi, don_vi, khoa_phong_quan_ly, tinh_trang_hien_tai, is_deleted)
  values
    (v_tb_a, 'ZBS-TB-A-618', 'ZBS Device A 618', v_fac_a, 'ICU', 'Hoat dong', false),
    (v_tb_b, 'ZBS-TB-B-618', 'ZBS Device B 618', v_fac_b, 'ER', 'Hoat dong', false),
    (v_tb_c, 'ZBS-TB-C-618', 'ZBS Device C 618', v_fac_c, 'LAB', 'Hoat dong', false);

  insert into public.zbs_recipient_configs (don_vi_id, event_type, recipient_phone, active)
  values
    (v_fac_a, 'repair_request_created', '84901111111', true),
    (v_fac_a, 'repair_request_created', '84902222222', true),
    (v_fac_a, 'repair_request_created', '84903333333', false),
    (v_fac_a, 'transfer_request_created', '84905555555', true),
    (v_fac_b, 'repair_request_created', '84904444444', true),
    (v_fac_c, 'repair_request_created', '84906666666', false);

  perform set_config('request.jwt.claims', jsonb_build_object(
    'app_role', 'to_qltb',
    'user_id', '618001',
    'don_vi', v_fac_a::text
  )::text, true);

  v_req_a := public.repair_request_create(
    v_tb_a::integer,
    'A needs repair',
    'Check A',
    current_date + 3,
    'Tester A',
    'noi_bo',
    null
  );

  select count(*), array_agg(recipient_phone order by recipient_phone)
  into v_count, v_phones
  from public.zbs_notification_outbox
  where event_type = 'repair_request_created'
    and source_type = 'repair_request'
    and source_id = v_req_a;

  if v_count <> 2 or v_phones <> array['84901111111', '84902222222']::text[] then
    raise exception 'tenant A expected two active recipients only, got count %, phones %', v_count, v_phones;
  end if;

  if exists (
    select 1
    from public.zbs_notification_outbox
    where source_id = v_req_a
      and (don_vi_id <> v_fac_a or recipient_phone in ('84903333333', '84904444444', '84905555555'))
  ) then
    raise exception 'tenant A outbox leaked inactive, other-event, or other-tenant recipients';
  end if;

  if exists (
    select 1
    from public.zbs_notification_outbox
    where source_id = v_req_a
      and (
        template_data ->> 'equipment_code' <> 'ZBS-TB-A-618'
        or template_data ->> 'equipment_name' <> 'ZBS Device A 618'
        or template_data ->> 'issue_description' <> 'A needs repair'
      )
  ) then
    raise exception 'tenant A outbox template_data did not snapshot repair request details';
  end if;

  perform set_config('request.jwt.claims', jsonb_build_object(
    'app_role', 'to_qltb',
    'user_id', '618002',
    'don_vi', v_fac_b::text
  )::text, true);

  v_req_b := public.repair_request_create(
    v_tb_b::integer,
    'B needs repair',
    'Check B',
    current_date + 4,
    'Tester B',
    'noi_bo',
    null
  );

  select count(*), array_agg(recipient_phone order by recipient_phone)
  into v_count, v_phones
  from public.zbs_notification_outbox
  where event_type = 'repair_request_created'
    and source_type = 'repair_request'
    and source_id = v_req_b;

  if v_count <> 1 or v_phones <> array['84904444444']::text[] then
    raise exception 'tenant B expected only tenant B recipient, got count %, phones %', v_count, v_phones;
  end if;

  if exists (
    select 1
    from public.zbs_notification_outbox
    where source_id = v_req_b
      and recipient_phone in ('84901111111', '84902222222')
  ) then
    raise exception 'tenant B request enqueued tenant A recipients';
  end if;

  perform set_config('request.jwt.claims', jsonb_build_object(
    'app_role', 'to_qltb',
    'user_id', '618003',
    'don_vi', v_fac_c::text
  )::text, true);

  v_req_c := public.repair_request_create(
    v_tb_c::integer,
    'C needs repair',
    'Check C',
    current_date + 5,
    'Tester C',
    'noi_bo',
    null
  );

  select count(*)
  into v_count
  from public.zbs_notification_outbox
  where event_type = 'repair_request_created'
    and source_type = 'repair_request'
    and source_id = v_req_c;

  if v_count <> 0 then
    raise exception 'tenant C with no active recipients expected no fallback outbox rows, got %', v_count;
  end if;

  select *
  into v_duplicate
  from public.zbs_notification_outbox
  where source_id = v_req_a
  order by recipient_phone
  limit 1;

  begin
    insert into public.zbs_notification_outbox (
      event_type,
      source_type,
      source_id,
      don_vi_id,
      recipient_config_id,
      recipient_phone,
      template_data
    )
    values (
      v_duplicate.event_type,
      v_duplicate.source_type,
      v_duplicate.source_id,
      v_duplicate.don_vi_id,
      v_duplicate.recipient_config_id,
      v_duplicate.recipient_phone,
      v_duplicate.template_data
    );

    raise exception 'duplicate logical outbox key was accepted';
  exception
    when unique_violation then
      null;
  end;
end;
$$;

rollback;
