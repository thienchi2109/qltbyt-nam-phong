-- Transfers RPC hardening: richer status handling + completion logic
-- Idempotent: uses CREATE OR REPLACE and preserves signatures where applicable

create or replace function public.transfer_request_update_status(
  p_id int,
  p_status text,
  p_payload jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
as $$
begin
  -- Update core status and timestamps
  update yeu_cau_luan_chuyen
  set trang_thai = p_status,
      updated_at = now()
  where id = p_id;

  if p_status = 'da_duyet' then
    update yeu_cau_luan_chuyen
      set nguoi_duyet_id = nullif(p_payload->>'nguoi_duyet_id','')::int,
          ngay_duyet = coalesce((p_payload->>'ngay_duyet')::timestamptz, now())
    where id = p_id;
  elsif p_status in ('dang_luan_chuyen', 'da_ban_giao') then
    update yeu_cau_luan_chuyen
      set ngay_ban_giao = coalesce((p_payload->>'ngay_ban_giao')::timestamptz, now())
    where id = p_id;
  elsif p_status = 'hoan_thanh' then
    update yeu_cau_luan_chuyen
      set ngay_hoan_thanh = coalesce((p_payload->>'ngay_hoan_thanh')::timestamptz, now()),
          ngay_hoan_tra = coalesce((p_payload->>'ngay_hoan_tra')::timestamptz, ngay_hoan_tra)
    where id = p_id;
  end if;
end; $$;

-- Completion helper: finalize transfer and update equipment + history atomically
create or replace function public.transfer_request_complete(
  p_id int,
  p_payload jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
as $$
declare
  v_req yeu_cau_luan_chuyen;
  v_mo_ta text;
  v_loai_su_kien text;
begin
  select * into v_req from yeu_cau_luan_chuyen where id = p_id;
  if not found then return; end if;

  -- Mark as completed
  update yeu_cau_luan_chuyen
    set trang_thai = 'hoan_thanh',
        ngay_hoan_thanh = now(),
        ngay_hoan_tra = coalesce((p_payload->>'ngay_hoan_tra')::timestamptz, case when v_req.loai_hinh = 'ben_ngoai' then now() else ngay_hoan_tra end),
        updated_at = now()
  where id = p_id;

  -- Update equipment depending on transfer type
  if v_req.loai_hinh = 'noi_bo' and v_req.khoa_phong_nhan is not null then
    update thiet_bi
      set khoa_phong_quan_ly = v_req.khoa_phong_nhan
    where id = v_req.thiet_bi_id;
  elsif v_req.loai_hinh = 'thanh_ly' then
    update thiet_bi
      set tinh_trang = 'Ngưng sử dụng',
          khoa_phong_quan_ly = 'Tổ QLTB'
    where id = v_req.thiet_bi_id;
  end if;

  -- Build history description
  if v_req.loai_hinh = 'noi_bo' then
    v_loai_su_kien := 'Luân chuyển';
    v_mo_ta := format('Thiết bị được luân chuyển từ "%s" đến "%s".', coalesce(v_req.khoa_phong_hien_tai,''), coalesce(v_req.khoa_phong_nhan,''));
  elsif v_req.loai_hinh = 'thanh_ly' then
    v_loai_su_kien := 'Thanh lý';
    v_mo_ta := format('Thiết bị được thanh lý. Lý do: %s', coalesce(v_req.ly_do_luan_chuyen,''));
  else
    v_loai_su_kien := 'Luân chuyển';
    v_mo_ta := format('Thiết bị được hoàn trả từ đơn vị bên ngoài "%s".', coalesce(v_req.don_vi_nhan,''));
  end if;

  -- Insert general equipment history
  insert into lich_su_thiet_bi(thiet_bi_id, loai_su_kien, mo_ta, chi_tiet)
  values (
    v_req.thiet_bi_id,
    v_loai_su_kien,
    v_mo_ta,
    jsonb_build_object(
      'ma_yeu_cau', v_req.ma_yeu_cau,
      'loai_hinh', v_req.loai_hinh,
      'khoa_phong_hien_tai', v_req.khoa_phong_hien_tai,
      'khoa_phong_nhan', v_req.khoa_phong_nhan,
      'don_vi_nhan', v_req.don_vi_nhan,
      'yeu_cau_id', v_req.id
    )
  );
end; $$;

grant execute on function public.transfer_request_update_status(int, text, jsonb) to authenticated;
grant execute on function public.transfer_request_complete(int, jsonb) to authenticated;
