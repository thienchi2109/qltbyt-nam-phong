"""Disposable-only TM-04 two-session races. Run with a JSON psql command argument.

Example: python3 this_file.py '["psql","-X","-At","-d","tm04_disposable"]'
Fixtures commit across sessions and remain until the caller drops the disposable DB.
The caller must independently verify clone deletion; never register as default-safe.
"""
import json
import subprocess
import sys
import time


def run(command):
    def query(sql):
        result = subprocess.run(command, input=sql, text=True, capture_output=True, timeout=15)
        if result.returncode:
            raise AssertionError(result.stderr[-1500:])
        return result.stdout

    database = query('SELECT current_database();').strip().splitlines()[-1]
    assert database.startswith(('tm04_', 'tm05_')), 'Only an explicitly disposable tm04_*/tm05_* database is permitted'
    fixture = json.loads(query("""
WITH t AS (SELECT id FROM public.don_vi ORDER BY id LIMIT 1),
e AS (INSERT INTO public.thiet_bi(ma_thiet_bi,ten_thiet_bi,don_vi,khoa_phong_quan_ly,tinh_trang_hien_tai)
  SELECT 'TM04-RACE-'||gen_random_uuid(),'TM04 concurrent fixture',id,'TM04 Race','Hoạt động' FROM t RETURNING id,don_vi)
SELECT json_build_object('equipment',e.id,'tenant',e.don_vi,'actor',(SELECT id FROM public.nhan_vien ORDER BY id LIMIT 1),
  'profile',(SELECT id FROM public.temperature_monitoring_schedule_profiles WHERE code='default'),
  'shift',(SELECT id FROM public.temperature_monitoring_schedule_shifts WHERE code='dem' AND schedule_profile_id=(SELECT id FROM public.temperature_monitoring_schedule_profiles WHERE code='default'))) FROM e;
""").strip().splitlines()[-1])
    query(f"""
INSERT INTO public.temperature_monitoring_recording_methods(code,name) VALUES ('tm04-race','TM04 race method') ON CONFLICT DO NOTHING;
INSERT INTO public.temperature_monitoring_configuration_versions(equipment_id,effective_period,lower_c,upper_c,schedule_profile_id,recording_method_code,responsible_primary_user_id,change_reason)
VALUES ({fixture['equipment']},tstzrange('2026-07-01 00:00Z','2026-07-10 00:00Z','[)'),2,8,'{fixture['profile']}','tm04-race',{fixture['actor']},'TM04 race');
""")
    claims = json.dumps(dict(app_role='to_qltb',user_id=fixture['actor'],don_vi=fixture['tenant'],khoa_phong='TM04 Race'))
    scope = f"SELECT set_config('request.jwt.claims','{claims}',false);\n"

    def reading(date, value):
        return f"SELECT public.temperature_monitoring_measurement_create({fixture['equipment']},'{date}','{fixture['shift']}',{value},NULL,'{date} 23:00Z');\n"

    def json_result(output):
        return [json.loads(line) for line in output.splitlines() if line.startswith('{') and 'outcome' in line][-1]

    def race(label, winner_sql, loser_sql, commit=True, expect_error=False):
        winner = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1)
        loser = None
        try:
            winner.stdin.write("SET statement_timeout='15s';\nBEGIN;\n"+scope+winner_sql+"SELECT 'TM04_READY';\n")
            winner.stdin.flush()
            winner_output = ''
            deadline = time.monotonic()+15
            while time.monotonic()<deadline:
                line = winner.stdout.readline()
                assert line, 'winner exited before rendezvous'
                winner_output += line
                if line.strip()=='TM04_READY':
                    break
            else:
                raise AssertionError('winner rendezvous timed out')
            loser = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            loser.stdin.write("SET statement_timeout='15s';\nSET application_name='tm04-race-loser';\n"+scope+loser_sql)
            loser.stdin.close()
            deadline = time.monotonic()+10
            while time.monotonic()<deadline:
                blocked = query("SELECT count(*) FROM pg_stat_activity WHERE application_name='tm04-race-loser' AND wait_event='advisory';").strip().splitlines()[-1]
                if blocked=='1':
                    break
                assert loser.poll() is None, 'loser did not wait for the transaction lock'
                time.sleep(.05)
            else:
                raise AssertionError('no advisory-lock wait observed')
            winner.stdin.write(('COMMIT' if commit else 'ROLLBACK')+';\n\\q\n')
            winner.stdin.flush()
            winner.wait(timeout=10)
            assert winner.returncode==0, winner.stderr.read()
            loser.wait(timeout=10)
            output, error = loser.stdout.read(), loser.stderr.read()
            if expect_error:
                assert loser.returncode!=0 and 'slot is not eligible' in error, error
                result = None
            else:
                assert loser.returncode==0, error
                result = json_result(output)
            print(f'{label}: observed advisory wait, '+('safe rejection' if expect_error else result['outcome']),flush=True)
            return winner_output, result
        finally:
            for process in (winner,loser):
                if process and process.poll() is None:
                    process.kill()
                    process.wait(timeout=10)

    winner, result = race('duplicate winner commit',reading('2026-07-02',9),reading('2026-07-02',7))
    assert result['outcome']=='conflict' and result['reading']['id']==json_result(winner)['reading']['id']
    _, result = race('duplicate winner rollback',reading('2026-07-03',9),reading('2026-07-03',7),commit=False)
    assert result['outcome']=='created' and result['reading']['value_c']==7

    def new_policy(start,end):
        return f"""
INSERT INTO public.temperature_monitoring_configuration_versions(equipment_id,effective_period,lower_c,upper_c,schedule_profile_id,recording_method_code,responsible_primary_user_id,change_reason)
VALUES ({fixture['equipment']},tstzrange('{start} 00:00Z','{end} 00:00Z','[)'),3,7,'{fixture['profile']}','tm04-race',{fixture['actor']},'TM04 concurrent policy');
SELECT public.temperature_monitoring_schedule_shift_override_upsert('{fixture['profile']}',{fixture['tenant']},'{fixture['shift']}',NULL,'23:00','07:00');
"""

    _, result = race('policy+absent override commit',new_policy('2026-07-10','2026-07-20'),reading('2026-07-11',7))
    assert result['reading']['lower_c']==3 and result['reading']['upper_c']==7
    assert result['reading']['snapshot']['shift_start_local']=='23:00:00'
    race('policy rollback',new_policy('2026-07-20','2026-07-30'),reading('2026-07-21',7),commit=False,expect_error=True)
    counts = query(f"""
SELECT count(*),count(DISTINCT (equipment_id,monitoring_date,shift_id)) FROM public.temperature_readings WHERE equipment_id={fixture['equipment']};
SELECT count(*),count(*) FILTER (WHERE event_type='deviation_created') FROM public.temperature_monitoring_reading_events WHERE reading_id IN (SELECT id FROM public.temperature_readings WHERE equipment_id={fixture['equipment']});
""").strip().splitlines()
    assert counts==['3|3','4|1'], counts
    print('CONCURRENCY PASS: 3 unique readings, 3 creation events, exactly 1 breach event',flush=True)


if __name__=='__main__':
    run(json.loads(sys.argv[1]))
