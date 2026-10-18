"""TM-05 real two-session races; committed fixtures require a disposable tm05_* DB.

Run: python3 this_file.py '["psql","-X","-qAt","-d","tm05_disposable","-v","ON_ERROR_STOP=1"]'
Caller must drop its clone in finally and independently verify pg_database absence.
"""
import json
import subprocess
import sys
import time


def run(command):
    def query(sql):
        result = subprocess.run(command, input=sql, text=True, capture_output=True, timeout=20)
        assert result.returncode == 0, result.stderr[-1800:]
        return result.stdout.strip()

    assert query('SELECT current_database();').startswith(('tm05_', 'tm06_')), 'disposable tm05_*/tm06_* database required'
    fixture = json.loads(query("""
WITH t AS (SELECT id FROM public.don_vi ORDER BY id LIMIT 1),
e AS (INSERT INTO public.thiet_bi(ma_thiet_bi,ten_thiet_bi,don_vi,khoa_phong_quan_ly,tinh_trang_hien_tai)
SELECT 'TM05-RACE-'||gen_random_uuid(),'TM05 concurrent fixture',id,'TM05 Race','Hoạt động' FROM t RETURNING id,don_vi)
SELECT json_build_object('equipment',e.id,'tenant',e.don_vi,'actors',(SELECT array_agg(id) FROM (SELECT id FROM public.nhan_vien ORDER BY id LIMIT 3) n),
'profile',(SELECT id FROM public.temperature_monitoring_schedule_profiles WHERE code='default'),
'shift',(SELECT id FROM public.temperature_monitoring_schedule_shifts WHERE code='dem' AND schedule_profile_id=(SELECT id FROM public.temperature_monitoring_schedule_profiles WHERE code='default'))) FROM e;
"""))
    operator, author, reviewer = fixture['actors']
    query(f"""
INSERT INTO public.temperature_monitoring_recording_methods(code,name) VALUES('tm05-race','TM05 race');
INSERT INTO public.temperature_monitoring_configuration_versions(equipment_id,effective_period,lower_c,upper_c,schedule_profile_id,recording_method_code,responsible_primary_user_id,change_reason)
VALUES({fixture['equipment']},tstzrange('2026-07-01Z','2026-07-10Z','[)'),2,8,'{fixture['profile']}','tm05-race',{operator},'TM05 race');
""")

    def scope(actor):
        claims = json.dumps(dict(app_role='to_qltb', user_id=actor, don_vi=fixture['tenant'], khoa_phong='TM05 Race'))
        return f"SELECT set_config('request.jwt.claims','{claims}',false);\n"

    def result(output):
        return [json.loads(line) for line in output.splitlines() if line.startswith('{') and 'outcome' in line][-1]

    readings = []
    for day, value in [(2, 5), (3, 9), (4, 5), (5, 5)]:
        readings.append(result(query(scope(operator) + f"SELECT public.temperature_monitoring_measurement_create({fixture['equipment']},'2026-07-0{day}','{fixture['shift']}',{value});")))
    originals = [item['reading'] for item in readings]

    def amend(index, revision=0):
        return f"SELECT public.temperature_monitoring_amendment_create('{originals[index]['id']}',{revision},8.1,NULL,'source corrected');\n"

    def review(index, revision, action, proposal=None):
        target = f",'{proposal}'" if proposal else ''
        return f"SELECT public.temperature_monitoring_reading_review('{originals[index]['id']}',{revision},'{action}','source checked'{target});\n"

    def race(label, winner_sql, loser_sql, winner_actor, loser_actor, commit=True):
        winner = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1)
        loser = None
        try:
            winner.stdin.write("SET statement_timeout='15s';\nBEGIN;\n" + scope(winner_actor) + winner_sql + "SELECT 'TM05_READY';\n")
            winner.stdin.flush()
            output = ''
            while True:
                line = winner.stdout.readline()
                assert line, winner.stderr.read()
                output += line
                if line.strip() == 'TM05_READY':
                    break
            loser = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            loser.stdin.write("SET statement_timeout='15s';\nSET application_name='tm05-race-loser';\n" + scope(loser_actor) + loser_sql)
            loser.stdin.close()
            deadline = time.monotonic() + 10
            while time.monotonic() < deadline:
                blocked = query("SELECT count(*) FROM pg_stat_activity WHERE application_name='tm05-race-loser' AND wait_event_type='Lock';")
                if blocked == '1':
                    break
                assert loser.poll() is None, 'loser failed to wait'
                time.sleep(.05)
            else:
                raise AssertionError('no database-lock wait observed')
            winner.stdin.write(('COMMIT' if commit else 'ROLLBACK') + ';\n\\q\n')
            winner.stdin.flush()
            winner.wait(timeout=10)
            assert winner.returncode == 0, winner.stderr.read()
            loser.wait(timeout=10)
            assert loser.returncode == 0, loser.stderr.read()
            losing_result = result(loser.stdout.read())
            assert losing_result['outcome'] == ('conflict' if commit else 'created'), losing_result
            print(f'{label}: observed database lock wait; loser {losing_result["outcome"]}', flush=True)
            return result(output), losing_result
        finally:
            for process in (winner, loser):
                if process and process.poll() is None:
                    process.kill()
                    process.wait(timeout=10)

    proposed, _ = race('competing proposals', amend(0), amend(0), author, reviewer)
    proposal = proposed['pending_amendment']['id']
    revision = proposed['revision']
    race('approve versus reject', review(0, revision, 'approve_amendment', proposal), review(0, revision, 'reject_amendment', proposal), reviewer, reviewer)
    race('confirmation versus amendment', review(1, 0, 'confirm'), amend(1), reviewer, author)
    race('reopen versus amendment', review(2, 0, 'reopen'), amend(2), reviewer, author)
    race('winner rollback', amend(3), amend(3), author, reviewer, commit=False)
    current_originals = json.loads(query(f"SELECT json_agg(r ORDER BY monitoring_date) FROM public.temperature_readings r WHERE equipment_id={fixture['equipment']};"))
    assert current_originals == originals, 'original readings changed'
    counts = query(f"""
SELECT count(*) FILTER(WHERE event_type='amendment_created'),count(*) FILTER(WHERE event_type='amendment_approved'),
count(*) FILTER(WHERE event_type='amendment_rejected'),count(*) FILTER(WHERE event_type='reading_confirmed'),
count(*) FILTER(WHERE event_type='reading_reopened'),count(*) FILTER(WHERE event_type='deviation_created')
FROM public.temperature_monitoring_reading_events WHERE reading_id IN(SELECT id FROM public.temperature_readings WHERE equipment_id={fixture['equipment']});
""")
    assert counts == '2|1|0|1|1|2', counts
    print('TM05 CONCURRENCY PASS: exact events and immutable originals verified', flush=True)


if __name__ == '__main__':
    run(json.loads(sys.argv[1]))
