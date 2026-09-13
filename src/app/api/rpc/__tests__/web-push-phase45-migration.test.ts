import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const MIGRATION = "20260913020000_web_push_recipient_config_phase45.sql"

function readMigration() {
  return readFileSync(path.resolve(process.cwd(), "supabase/migrations", MIGRATION), "utf8")
}

describe("Web Push Phase 4.5 migration", () => {
  it("adds provenance and server-authorized candidate/config RPCs", () => {
    const source = readMigration()

    expect(source).toContain("ADD COLUMN protected_by_user_id BIGINT")
    expect(source).toContain("web_push_recipient_is_eligible")
    expect(source).toContain("web_push_recipient_candidates")
    expect(source).toContain("p_self_action TEXT")
    expect(source).toContain("protected_by_user_id")
    expect(source).toContain("status")
    expect(source).toContain("editable")
    expect(source).toContain(
      "REVOKE ALL ON FUNCTION public.web_push_recipient_config_set(bigint,text[])"
    )
    expect(source).toContain(
      "GRANT EXECUTE ON FUNCTION public.web_push_recipient_config_set(bigint,text[],text)"
    )
  })

  it("keeps normal membership validation separate from protected provenance", () => {
    const source = readMigration()

    expect(source).toContain("web_push_recipient_is_eligible(m.id, p_don_vi, NULL)")
    expect(source).toContain("cfg.protected_by_user_id")
    expect(source).toContain("self_action")
    expect(source).toContain("FOR UPDATE")
    expect(source).toContain("invalid_recipients")
  })

  it("preserves protected rows when a role-changed account is newly eligible", () => {
    const source = readMigration()

    expect(source).toContain("cfg.user_id = ANY(v_ids)")
    expect(source).toContain("v_protected_count + v_count - v_protected_overlap > 100")
    expect(source).toContain("ON CONFLICT (don_vi_id, user_id) DO NOTHING")
  })
})
