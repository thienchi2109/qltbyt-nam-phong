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
  it("normalizes app roles for Postgres app_role claims", () => {
    expect(toAppRoleClaim("admin")).toBe("global")
    expect(toAppRoleClaim(" ADMIN ")).toBe("global")
    expect(toAppRoleClaim("GLOBAL")).toBe("global")
    expect(toAppRoleClaim(" To_Qltb ")).toBe("to_qltb")
  })

  it("rejects missing required user id claims", () => {
    expect(() => toRequiredUserIdClaim(undefined)).toThrow(
      "Cannot mint Supabase RPC JWT without user id",
    )
    expect(() => toRequiredUserIdClaim("")).toThrow(
      "Cannot mint Supabase RPC JWT without user id",
    )
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
      }),
    ).toEqual({
      role: "authenticated",
      iat: 100,
      exp: 220,
      sub: "42",
      user_id: "42",
      app_role: "global",
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
      }),
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

  it("rejects missing role before building RPC JWT claims", () => {
    expect(() =>
      buildSupabaseRpcJwtClaims({
        user: { id: "31", role: "" },
        issuedAt: 100,
        expiresAt: 220,
      }),
    ).toThrow("Cannot mint Supabase RPC JWT without app_role")
  })
})
