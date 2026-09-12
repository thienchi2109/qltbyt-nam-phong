import { tokenizeSqlSegment } from "./static-sql-tokens"

const SESSION_USER_GUARD_SHAPE = `
DECLARE c jsonb; v_id bigint; v_role text;
BEGIN
  c := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
  IF c->>'user_id' IS NULL OR c->>'user_id' !~ '^[1-9][0-9]*$'
    OR (c->>'role' IS NOT NULL AND c->>'role'<>'authenticated') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  v_id := (c->>'user_id')::bigint; v_role := c->>'app_role';
  IF v_id IS NULL OR v_role IS NULL OR v_role NOT IN ('global','admin','chuyen_gia','regional_leader','to_qltb','technician','qltb_khoa','user') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.get_session_authorization_profile_for_jwt(v_id) p WHERE p.dia_ban_id IS NOT NULL) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  RETURN v_id;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
  RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
END;
`

const SESSION_USER_GUARD_TOKENS = tokenizeSqlSegment(SESSION_USER_GUARD_SHAPE).map(
  (token) => `${token.type}:${token.value}`
)

// ponytail: Token-exact recognition is the ceiling; add a PL/pgSQL control-flow analyzer for new shapes.
/** Matches the audited web-push session guard and rejects every semantic mutation. */
export function hasFailClosedSessionUserGuard(content: string): boolean {
  const tokens = tokenizeSqlSegment(content).map((token) => `${token.type}:${token.value}`)

  return JSON.stringify(tokens) === JSON.stringify(SESSION_USER_GUARD_TOKENS)
}
