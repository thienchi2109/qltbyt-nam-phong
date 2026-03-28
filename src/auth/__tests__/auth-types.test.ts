import { describe, expect, it } from "vitest"
import {
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

  it("applies refreshed profile data onto the JWT payload", () => {
    const token = applyJwtProfileRefresh(
      {
        id: "31",
        username: "minh",
        role: "user",
        khoa_phong: "OLD",
        full_name: "Old Name",
        auth_mode: "dual_mode",
        loginTime: 123,
      },
      {
        current_don_vi: 17,
        don_vi: 16,
        khoa_phong: "NEW",
        full_name: "New Name",
        dia_ban_id: 9,
      },
      17
      ,
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
  })

  it("hydrates a session from the JWT payload", () => {
    const session = applyJwtToSession(
      {
        user: {
          name: "Minh",
          email: "minh@example.com",
          image: null,
        },
      },
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
    })
  })
})
