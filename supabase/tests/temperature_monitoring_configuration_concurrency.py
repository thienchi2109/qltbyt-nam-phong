"""Disposable-only two-session configuration replacement race.

Call run(command) on a disposable ``tm07_*`` clone; fixtures commit, so the caller
must drop the database after the race. No transfer or revalidation race is covered.
CLI: python3 <this-file> psql <connection-options> -X -qAt -v ON_ERROR_STOP=1
"""
import json
import subprocess
import sys
import time


def run(command):
    def query(sql):
        result = subprocess.run(command, input="\\set VERBOSITY verbose\n" + sql, text=True, capture_output=True, timeout=20)
        if result.returncode:
            raise AssertionError(result.stderr[-2000:])
        return result.stdout.strip()

    database = query("SELECT current_database();")
    assert database.startswith(("tm07_", "tm07lead_")), f"disposable TM-07 database required, got {database}"
    fixture = json.loads(query("""
WITH staff AS (
  SELECT n.id,n.don_vi,NULLIF(btrim(n.khoa_phong),'') AS department
  FROM public.nhan_vien n
  WHERE COALESCE(n.is_active,TRUE) AND n.don_vi IS NOT NULL
    AND (n.current_don_vi IS NULL OR n.current_don_vi=n.don_vi)
    AND NULLIF(btrim(n.khoa_phong),'') IS NOT NULL
  ORDER BY n.id LIMIT 1
), equipment AS (
  INSERT INTO public.thiet_bi(ma_thiet_bi,ten_thiet_bi,don_vi,khoa_phong_quan_ly,tinh_trang_hien_tai)
  SELECT 'TM07-CONFIG-RACE-'||gen_random_uuid(),'TM07 configuration race',don_vi,department,'Hoạt động' FROM staff
  RETURNING id,don_vi,khoa_phong_quan_ly
), boundary AS (
  SELECT min(boundary) AS start FROM (
    SELECT DISTINCT ((d.day+COALESCE(o.start_local,s.start_local)) AT TIME ZONE 'Asia/Ho_Chi_Minh') AS boundary
    FROM generate_series(((statement_timestamp()+INTERVAL '1 minute') AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE::TIMESTAMP,
      ((((statement_timestamp()+INTERVAL '1 minute') AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE+14)::TIMESTAMP),INTERVAL '1 day') d(day)
    JOIN public.temperature_monitoring_schedule_profiles p ON p.code='default' AND p.is_active
    JOIN public.temperature_monitoring_schedule_shifts s ON s.schedule_profile_id=p.id AND s.is_active
    CROSS JOIN equipment e
    LEFT JOIN public.temperature_monitoring_schedule_shift_overrides o
      ON o.schedule_profile_id=s.schedule_profile_id AND o.shift_id=s.id AND o.don_vi=e.don_vi AND o.is_active
    WHERE ((d.day+COALESCE(o.start_local,s.start_local)) AT TIME ZONE 'Asia/Ho_Chi_Minh')>statement_timestamp()+INTERVAL '1 minute'
    ORDER BY boundary
  ) q
)
SELECT json_build_object(
  'equipment',e.id,'tenant',e.don_vi,'department',e.khoa_phong_quan_ly,
  'actor',(SELECT id FROM staff),'profile',(SELECT id FROM public.temperature_monitoring_schedule_profiles WHERE code='default' AND is_active LIMIT 1),
  'recording_method',(SELECT code FROM public.temperature_monitoring_recording_methods WHERE is_active ORDER BY code LIMIT 1),
  'start',b.start
) FROM equipment e CROSS JOIN boundary b;
"""))
    equipment, actor = fixture["equipment"], fixture["actor"]
    profile, method = fixture["profile"], fixture["recording_method"]
    first = fixture["start"]
    assert first, fixture
    query(f"""
INSERT INTO public.temperature_monitoring_configurations(equipment_id,monitoring_enabled) VALUES({equipment},TRUE);
INSERT INTO public.temperature_monitoring_configuration_versions(
  equipment_id,effective_period,monitoring_enabled,lower_c,upper_c,schedule_profile_id,display_timezone,
  responsible_primary_user_id,recording_method_code,change_reason,created_by
) VALUES({equipment},tstzrange(statement_timestamp()-INTERVAL '2 days',NULL,'[)'),TRUE,2,8,'{profile}',
  'Asia/Ho_Chi_Minh',{actor},'{method}','TM07 race predecessor',{actor});
""")

    claims = json.dumps(dict(app_role="to_qltb", user_id=actor, don_vi=fixture["tenant"],
                             khoa_phong="  " + fixture["department"] + "  ")).replace("'", "''")
    scope = f"SET statement_timeout='15s'; SET lock_timeout='10s'; SELECT set_config('request.jwt.claims','{claims}',false);\n"

    def replacement(start, reason):
        return (f"SELECT public.temperature_monitoring_configuration_upsert({equipment},TRUE,'{start}'::timestamptz,NULL,"
                f"3,7,'{profile}'::uuid,'Asia/Ho_Chi_Minh',{actor},'{{}}'::bigint[],'{method}','{reason}');")

    holder = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                              text=True, bufsize=1)
    waiter = None
    try:
        holder.stdin.write(scope + "SET application_name='tm07_config_holder'; BEGIN;\n" +
                           replacement(first, "TM07 first concurrent replacement") +
                           "\nSELECT pg_sleep(4); COMMIT;\n")
        holder.stdin.close()
        def wait_for(predicate, message):
            deadline = time.monotonic() + 10
            while time.monotonic() < deadline:
                if query(predicate) == "t":
                    return
                if holder.poll() is not None:
                    raise AssertionError(holder.stderr.read()[-2000:])
                time.sleep(0.05)
            raise AssertionError(message)

        wait_for("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() "
                 "AND application_name='tm07_config_holder' AND wait_event='PgSleep');",
                 "first replacement did not retain its transaction lock")

        waiter = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                  text=True)
        waiter.stdin.write("\\set VERBOSITY verbose\n" + scope + "SET application_name='tm07_config_waiter';\n" +
                           replacement(first, "TM07 competing replacement") + "\n")
        waiter.stdin.close()
        wait_for("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() "
                 "AND application_name='tm07_config_waiter' AND wait_event_type='Lock');",
                 "second replacement never waited on a database lock")
        if waiter.poll() is not None:
            raise AssertionError("second replacement finished before observing a real lock wait")

        holder.wait(timeout=15)
        waiter.wait(timeout=15)
        holder_out, holder_err = holder.stdout.read(), holder.stderr.read()
        waiter_out, waiter_err = waiter.stdout.read(), waiter.stderr.read()
        assert holder.returncode == 0, holder_err[-2000:]
        assert (waiter.returncode != 0 and "22023" in waiter_err
                and "effective start must follow the open successor start" in waiter_err), waiter_err[-2000:]
        assert query(f"""
SELECT count(*)||'|'||count(*) FILTER(WHERE upper_inf(effective_period))||'|'||
  count(*) FILTER(WHERE lower(effective_period)='{first}'::timestamptz)||'|'||
  count(*) FILTER(WHERE upper(effective_period)='{first}'::timestamptz)
FROM public.temperature_monitoring_configuration_versions WHERE equipment_id={equipment};
""") == "2|1|1|1", (holder_out, waiter_out, waiter_err)
        assert query(f"""
SELECT count(*) FILTER(WHERE event_type='version_closed' AND after_state->>'effective_to'='{first}')||'|'||
  count(*) FILTER(WHERE event_type='version')
FROM public.temperature_monitoring_configuration_audit WHERE equipment_id={equipment};
""") == "1|1"
        print("PASS real two-session replacement race: lock wait, stale-start rejection, one successor", flush=True)
    finally:
        for process in (holder, waiter):
            if process and process.poll() is None:
                process.kill()
                process.wait(timeout=5)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("Pass a psql command targeting a disposable tm07_* database")
    run(sys.argv[1:])
