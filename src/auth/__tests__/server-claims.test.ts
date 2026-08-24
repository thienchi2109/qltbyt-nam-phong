import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import {
  buildSessionProfileJwtClaims,
  buildSupabaseRpcJwtClaims,
  toAppRoleClaim,
  toNullableJwtClaim,
  toRequiredUserIdClaim,
} from "../server-claims"

describe("server auth claims", () => {
  it.each([
    ["admin", "global"],
    [" ADMIN ", "global"],
    ["GLOBAL", "global"],
    ["chuyen_gia", "chuyen_gia"],
    [" CHUYEN_GIA ", "chuyen_gia"],
    ["regional_leader", "regional_leader"],
    [" To_Qltb ", "to_qltb"],
    ["technician", "technician"],
    ["qltb_khoa", "qltb_khoa"],
    ["user", "user"],
  ])("normalizes raw app role %j to %j", (role, expected) => {
    expect(toAppRoleClaim(role)).toBe(expected)
  })

  it("rejects missing required user id claims", () => {
    expect(() => toRequiredUserIdClaim(undefined)).toThrow(
      "Cannot mint Supabase RPC JWT without user id"
    )
    expect(() => toRequiredUserIdClaim("")).toThrow("Cannot mint Supabase RPC JWT without user id")
  })

  it("maps optional JWT claims to strings or null", () => {
    expect(toNullableJwtClaim(17)).toBe("17")
    expect(toNullableJwtClaim(" ICU ")).toBe("ICU")
    expect(toNullableJwtClaim(null)).toBeNull()
    expect(toNullableJwtClaim("")).toBeNull()
  })

  it("builds session profile refresh claims with normalized app role", () => {
    expect(
      buildSessionProfileJwtClaims({
        userId: "42",
        role: "admin",
        issuedAt: 100,
        expiresAt: 220,
      })
    ).toEqual({
      role: "authenticated",
      iat: 100,
      exp: 220,
      sub: "42",
      user_id: "42",
      app_role: "global",
    })
  })

  it("keeps the expert role unchanged in session profile refresh claims", () => {
    expect(
      buildSessionProfileJwtClaims({
        userId: "42",
        role: "chuyen_gia",
        issuedAt: 100,
        expiresAt: 220,
      })
    ).toMatchObject({
      app_role: "chuyen_gia",
    })
  })

  it("builds Supabase RPC JWT claims with the Postgres claim names", () => {
    expect(
      buildSupabaseRpcJwtClaims({
        user: {
          id: "31",
          role: "to_qltb",
          don_vi: 17,
          dia_ban_id: 10,
          khoa_phong: undefined,
        },
        issuedAt: 100,
        expiresAt: 220,
      })
    ).toEqual({
      role: "authenticated",
      iat: 100,
      exp: 220,
      sub: "31",
      app_role: "to_qltb",
      don_vi: "17",
      user_id: "31",
      dia_ban: "10",
      khoa_phong: null,
    })
  })

  it("keeps the expert role unchanged in Supabase RPC JWT claims", () => {
    expect(
      buildSupabaseRpcJwtClaims({
        user: {
          id: "31",
          role: "chuyen_gia",
        },
        issuedAt: 100,
        expiresAt: 220,
      })
    ).toMatchObject({
      app_role: "chuyen_gia",
    })
  })

  it("rejects missing role before building RPC JWT claims", () => {
    expect(() =>
      buildSupabaseRpcJwtClaims({
        user: { id: "31", role: "" },
        issuedAt: 100,
        expiresAt: 220,
      })
    ).toThrow("Cannot mint Supabase RPC JWT without app_role")
  })
})
