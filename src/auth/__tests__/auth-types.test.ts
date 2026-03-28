import { describe, expect, it } from "vitest"
import {
  applyAuthUserToJwt,
  applyJwtProfileRefresh,
  applyJwtToSession,
  buildAuthUserFromRpcResult,
} from "@/auth/types"

describe("auth type helpers", () => {
  it("maps RPC auth result into the NextAuth user payload", () => {
    const user = buildAuthUserFromRpcResult({
      is_authenticated: true,
      user_id: 42,
      username: "nqminh",
      full_name: "Nguyen Quang Minh",
      role: "to_qltb",
      khoa_phong: "KT",
      authentication_mode: "dual_mode",
      don_vi: 17,
      dia_ban_id: 9,
      dia_ban_ma: "HN-01",
    })

    expect(user).toEqual({
      id: "42",
      name: "Nguyen Quang Minh",
      username: "nqminh",
      role: "to_qltb",
      khoa_phong: "KT",
      full_name: "Nguyen Quang Minh",
      auth_mode: "dual_mode",
      don_vi: 17,
      dia_ban_id: 9,
      dia_ban_ma: "HN-01",
    })
  })

  it("applies sign-in user fields onto a new JWT object", () => {
    const originalToken = {
      id: "10",
      username: "legacy-user",
      role: "user",
      khoa_phong: "OLD",
      full_name: "Legacy User",
      auth_mode: "password_only",
      loginTime: 123,
    }

    const token = applyAuthUserToJwt(originalToken, {
      id: "31",
      username: "minh",
      role: "to_qltb",
      khoa_phong: "KT",
      full_name: "Nguyen Quang Minh",
      auth_mode: "dual_mode",
      don_vi: 17,
      dia_ban_id: 9,
      dia_ban_ma: "HN-01",
    })

    expect(token).toEqual({
      id: "31",
      username: "minh",
      role: "to_qltb",
      khoa_phong: "KT",
      full_name: "Nguyen Quang Minh",
      auth_mode: "dual_mode",
      don_vi: 17,
      dia_ban_id: 9,
      dia_ban_ma: "HN-01",
      loginTime: 123,
    })
    expect(token).not.toBe(originalToken)
    expect(originalToken).toEqual({
      id: "10",
      username: "legacy-user",
      role: "user",
      khoa_phong: "OLD",
      full_name: "Legacy User",
      auth_mode: "password_only",
      loginTime: 123,
    })
  })

  it("applies refreshed profile data onto the JWT payload", () => {
    const originalToken = {
      id: "31",
      username: "minh",
      role: "user",
      khoa_phong: "OLD",
      full_name: "Old Name",
      auth_mode: "dual_mode",
      loginTime: 123,
    }

    const token = applyJwtProfileRefresh(
      originalToken,
      {
        current_don_vi: 17,
        don_vi: 16,
        khoa_phong: "NEW",
        full_name: "New Name",
        dia_ban_id: 9,
      },
      17,
      9,
      null
    )

    expect(token).toEqual({
      id: "31",
      username: "minh",
      role: "user",
      khoa_phong: "NEW",
      full_name: "New Name",
      auth_mode: "dual_mode",
      loginTime: 123,
      don_vi: 17,
      dia_ban_id: 9,
      dia_ban_ma: null,
    })
    expect(token).not.toBe(originalToken)
    expect(originalToken).toEqual({
      id: "31",
      username: "minh",
      role: "user",
      khoa_phong: "OLD",
      full_name: "Old Name",
      auth_mode: "dual_mode",
      loginTime: 123,
    })
  })

  it("hydrates a session from the JWT payload", () => {
    const originalSession = {
      user: {
        name: "Minh",
        email: "minh@example.com",
        image: null,
      },
    }

    const session = applyJwtToSession(
      originalSession,
      {
        id: "31",
        username: "minh",
        role: "user",
        khoa_phong: "KT",
        don_vi: 17,
        current_don_vi: 17,
        dia_ban_id: 9,
        dia_ban_ma: "HN-01",
        full_name: "Nguyen Quang Minh",
        auth_mode: "dual_mode",
      }
    )

    expect(session.user).toEqual({
      name: "Minh",
      email: "minh@example.com",
      image: null,
      id: "31",
      username: "minh",
      role: "user",
      khoa_phong: "KT",
      don_vi: 17,
      current_don_vi: 17,
      dia_ban_id: 9,
      dia_ban_ma: "HN-01",
      full_name: "Nguyen Quang Minh",
      auth_mode: "dual_mode",
    })
    expect(session).not.toBe(originalSession)
    expect(session.user).not.toBe(originalSession.user)
    expect(originalSession).toEqual({
      user: {
        name: "Minh",
        email: "minh@example.com",
        image: null,
      },
    })
  })
})
