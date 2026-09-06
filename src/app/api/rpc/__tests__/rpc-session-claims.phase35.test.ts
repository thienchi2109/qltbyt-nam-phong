import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { getSessionClaims } from "../[fn]/rpc-session-claims"

describe("RPC session claims Phase 3.5 tenant identity", () => {
  it.each(["global", "admin", "to_qltb"])(
    "uses trusted current_don_vi before assigned don_vi for %s",
    (role) => {
      const claims = getSessionClaims({
        role,
        current_don_vi: 99,
        don_vi: 17,
        dia_ban_id: 9,
        khoa_phong: "KT",
        id: 31,
      })

      expect(claims?.donVi).toBe("99")
      expect(claims?.currentDonVi).toBe("99")
    }
  )

  it("falls back to assigned don_vi when current_don_vi is null", () => {
    const claims = getSessionClaims({
      role: "to_qltb",
      current_don_vi: null,
      don_vi: 17,
      dia_ban_id: 9,
      khoa_phong: "KT",
      id: 31,
    })

    expect(claims?.donVi).toBe("17")
  })

  it.each(["regional_leader", "chuyen_gia", "user"])(
    "keeps raw don_vi for non-target role %s",
    (role) => {
      const claims = getSessionClaims({
        role,
        current_don_vi: 99,
        don_vi: 17,
        dia_ban_id: 9,
        khoa_phong: role === "chuyen_gia" ? null : "KT",
        id: 31,
      })

      expect(claims?.donVi).toBe("17")
    }
  )
})
