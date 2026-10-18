"""Real lock-wait races; caller drops its disposable tm06_* clone in finally.

Run: python3 this_file.py '["psql","-X","-qAt","-d","tm06_disposable","-v","ON_ERROR_STOP=1"]'
"""
import json
import subprocess
import sys
import time


def run(command):
    def query(sql):
        result = subprocess.run(command, input=sql, text=True, capture_output=True, timeout=25)
        assert result.returncode == 0, result.stderr[-1800:]
        return result.stdout.strip()

    assert query('SELECT current_database();').startswith(('tm06_', 'tm07_')), 'disposable tm06_* required'
    fixture = json.loads(query("""
WITH t AS (SELECT id FROM public.don_vi ORDER BY id LIMIT 1),
e AS (INSERT INTO public.thiet_bi(ma_thiet_bi,ten_thiet_bi,don_vi,khoa_phong_quan_ly,tinh_trang_hien_tai)
SELECT 'TM06-RACE-'||gen_random_uuid(),'TM06 concurrent fixture',id,'TM06 Race','Hoạt động' FROM t RETURNING id,don_vi)
SELECT json_build_object('equipment',e.id,'tenant',e.don_vi,'actors',(SELECT array_agg(id) FROM (SELECT id FROM public.nhan_vien ORDER BY id LIMIT 3) n),
'profile',(SELECT id FROM public.temperature_monitoring_schedule_profiles WHERE code='default'),
'shift',(SELECT id FROM public.temperature_monitoring_schedule_shifts WHERE code='dem' AND schedule_profile_id=(SELECT id FROM public.temperature_monitoring_schedule_profiles WHERE code='default'))) FROM e;
"""))
    actor, author, reviewer = fixture['actors']
    equipment, shift = fixture['equipment'], fixture['shift']
    query(f"""
INSERT INTO public.temperature_monitoring_recording_methods(code,name) VALUES('tm06-race','TM06 race');
INSERT INTO public.temperature_monitoring_configuration_versions(equipment_id,effective_period,lower_c,upper_c,schedule_profile_id,recording_method_code,responsible_primary_user_id,change_reason)
VALUES({equipment},tstzrange('2026-07-01Z','2026-07-20Z','[)'),2,8,'{fixture['profile']}','tm06-race',{actor},'TM06 race');
""")

    def scope(user=actor, role='to_qltb'):
        claims = json.dumps(dict(app_role=role, user_id=user, don_vi=fixture['tenant'], khoa_phong='TM06 Race'))
        return f"SET statement_timeout='10s'; SET lock_timeout='8s'; SELECT set_config('request.jwt.claims','{claims}',false);\n"

    def result(output):
        return [json.loads(line) for line in output.splitlines() if line.startswith('{') and ('outcome' in line or 'deviation' in line)][-1]

    def wait_for(predicate, message):
        deadline = time.monotonic()+8
        while time.monotonic()<deadline:
            if query(predicate) == 't':
                return
            time.sleep(0.05)
        raise AssertionError(message)

    def race(first, second):
        # First transaction holds actual RPC locks until observer releases it.
        a = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        b = None
        try:
            a.stdin.write(scope()+"SET application_name='tm06_holder'; BEGIN;\n"+first+"\nSELECT pg_sleep(4); COMMIT;\n")
            a.stdin.flush()
            wait_for("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND application_name='tm06_holder' AND wait_event='PgSleep');", 'holder never reached RPC lock barrier')
            b = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            b.stdin.write(scope()+"SET application_name='tm06_waiter';\n"+second+"\n")
            b.stdin.close()
            wait_for("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND application_name='tm06_waiter' AND wait_event_type='Lock');", 'second session never waited on real DB lock')
            a.stdin.close()
            a.wait(timeout=15)
            b.wait(timeout=15)
            out_a, err_a, out_b, err_b = a.stdout.read(), a.stderr.read(), b.stdout.read(), b.stderr.read()
            assert a.returncode == 0, err_a[-1800:]
            return result(out_a), (result(out_b) if b.returncode == 0 else None), err_b
        finally:
            for process in (a, b):
                if process and process.poll() is None:
                    process.kill()
                    process.wait(timeout=5)

    create = f"SELECT public.temperature_monitoring_measurement_create({equipment},'2026-07-02','{shift}',9,NULL,'2026-07-02 16:00Z');"
    a, b, error = race(create, create)
    assert a['outcome']=='created' and b['outcome']=='conflict', (a,b,error)
    reading = a['reading']['id']
    case = result(query(scope()+f"SELECT public.temperature_monitoring_deviation_get(NULL,'{reading}');"))['deviation']['id']
    assert query(f"SELECT count(*) FROM public.temperature_monitoring_deviations WHERE reading_id='{reading}';")=='1'
    print('PASS real lock wait same-slot breach -> one reading/event/case', flush=True)

    request = query('SELECT gen_random_uuid();')
    update = f"SELECT public.temperature_monitoring_deviation_update('{case}',0,'{request}','update_action',p_immediate_action:='Quarantine');"
    a, b, error = race(update, update)
    assert a['outcome']=='updated' and b['replayed'] is True, (a,b,error)
    assert query(f"SELECT count(*) FROM public.temperature_monitoring_deviation_events WHERE deviation_id='{case}' AND request_id='{request}';")=='1'
    print('PASS real lock wait same request -> one case audit', flush=True)

    first = f"SELECT public.temperature_monitoring_deviation_update('{case}',1,gen_random_uuid(),'start');"
    second = f"SELECT public.temperature_monitoring_deviation_update('{case}',1,gen_random_uuid(),'update_action',p_cause:='different action');"
    a, b, error = race(first, second)
    assert a['outcome']=='updated' and b['outcome']=='conflict', (a,b,error)
    print('PASS real lock wait different actions -> stale revision conflict', flush=True)

    normal = result(query(scope()+f"SELECT public.temperature_monitoring_measurement_create({equipment},'2026-07-03','{shift}',5,NULL,'2026-07-03 16:00Z');"))['reading']['id']
    amendment = result(query(scope(author, 'user')+f"SELECT public.temperature_monitoring_amendment_create('{normal}',0,10,NULL,'new breach');"))
    proposal, revision = amendment['pending_amendment']['id'], amendment['revision']
    approve = scope(reviewer)+f"SELECT public.temperature_monitoring_reading_review('{normal}',{revision},'approve_amendment','checked','{proposal}');"
    a, b, error = race(approve, approve)
    assert a['outcome']=='updated' and b['outcome']=='conflict', (a,b,error)
    assert query(f"SELECT count(*) FROM public.temperature_monitoring_deviations WHERE reading_id='{normal}';")=='1'
    print('PASS real lock wait first-breach approval retries -> one case', flush=True)

    query(scope()+f"SELECT public.temperature_monitoring_deviation_update('{case}',2,gen_random_uuid(),'submit_verification');")
    close = f"SELECT public.temperature_monitoring_deviation_update('{case}',3,gen_random_uuid(),'close',p_verification_result:='Recovered');"
    stale = f"SELECT public.temperature_monitoring_deviation_update('{case}',3,gen_random_uuid(),'update_action',p_cause:='late correction');"
    a, b, error = race(close, stale)
    assert a['deviation']['status']=='Đã đóng' and b['outcome']=='conflict', (a,b,error)
    print('PASS real lock wait close vs action -> no lost update', flush=True)

    other = query(f"INSERT INTO public.thiet_bi(ma_thiet_bi,ten_thiet_bi,don_vi,khoa_phong_quan_ly,tinh_trang_hien_tai) VALUES('TM06-RETARGET-'||gen_random_uuid(),'other',{fixture['tenant']},'TM06 Race','Hoạt động') RETURNING id;")
    repair = query(f"INSERT INTO public.yeu_cau_sua_chua(thiet_bi_id,mo_ta_su_co,hang_muc_sua_chua,nguoi_yeu_cau,trang_thai) VALUES({equipment},'TM06','Check','TM06','Chờ xử lý') RETURNING id;")
    normal_case = result(query(scope()+f"SELECT public.temperature_monitoring_deviation_get(NULL,'{normal}');"))['deviation']['id']
    link = f"SELECT public.temperature_monitoring_deviation_update('{normal_case}',0,gen_random_uuid(),'link_repair',p_repair_request_id:={repair});"
    retarget = f"UPDATE public.yeu_cau_sua_chua SET thiet_bi_id={other} WHERE id={repair};"
    a, b, error = race(link, retarget)
    assert a['outcome']=='updated' and b is None and 'linked repair equipment cannot change' in error, (a,b,error)
    assert query(f"SELECT thiet_bi_id FROM public.yeu_cau_sua_chua WHERE id={repair};")==str(equipment)
    print('PASS real lock wait link vs direct retarget -> invariant preserved', flush=True)


if __name__ == '__main__':
    run(json.loads(sys.argv[1]))
