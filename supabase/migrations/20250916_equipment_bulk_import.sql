-- Bulk import equipment records via a single RPC call
-- This function loops through the provided JSONB array and calls equipment_create for each item,
-- ensuring all tenant/role checks and automatic don_vi assignment from JWT claims are applied.
-- Returns a JSON summary with counts and per-row results.

create or replace function public.equipment_bulk_import(p_items jsonb)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_len int;
  v_idx int := 0;
  v_success int := 0;
  v_failed int := 0;
  v_details jsonb := '[]'::jsonb;
  v_item jsonb;
  v_err text;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'p_items must be a JSON array' using errcode = '22P02';
  end if;

  v_len := jsonb_array_length(p_items);
  if v_len = 0 then
    return jsonb_build_object('success', true, 'inserted', 0, 'failed', 0, 'total', 0, 'details', '[]'::jsonb);
  end if;

  for v_idx in 0 .. v_len - 1 loop
    v_item := p_items->v_idx;
    begin
      -- Reuse existing single-insert RPC for validations and tenant assignment
      perform public.equipment_create(v_item);
      v_success := v_success + 1;
      v_details := v_details || jsonb_build_array(jsonb_build_object(
        'index', v_idx,
        'success', true
      ));
    exception when others then
      v_failed := v_failed + 1;
      get stacked diagnostics v_err = message_text;
      v_details := v_details || jsonb_build_array(jsonb_build_object(
        'index', v_idx,
        'success', false,
        'error', coalesce(v_err, SQLERRM)
      ));
    end;
  end loop;

  return jsonb_build_object(
    'success', true,
    'inserted', v_success,
    'failed', v_failed,
    'total', v_len,
    'details', v_details
  );
end;
$$;

grant execute on function public.equipment_bulk_import(jsonb) to authenticated;
