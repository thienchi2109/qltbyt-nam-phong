import type { Session, User } from "next-auth"
import type { JWT } from "next-auth/jwt"

type Assert<T extends true> = T

type UserHasId = Pick<User, "id"> extends { id: string } ? true : false
type UserHasUsername = Pick<User, "username"> extends { username: string } ? true : false
type UserHasRole = Pick<User, "role"> extends { role: string } ? true : false
type UserHasKhoaPhong = Pick<User, "khoa_phong"> extends { khoa_phong?: string | null } ? true : false
type UserHasDonVi = Pick<User, "don_vi"> extends { don_vi?: string | number | null } ? true : false
type UserHasCurrentDonVi = Pick<User, "current_don_vi"> extends { current_don_vi?: number | null } ? true : false
type UserHasDiaBanId = Pick<User, "dia_ban_id"> extends { dia_ban_id?: string | number | null } ? true : false
type UserHasDiaBanMa = Pick<User, "dia_ban_ma"> extends { dia_ban_ma?: string | null } ? true : false
type UserHasFullName = Pick<User, "full_name"> extends { full_name?: string | null } ? true : false
type UserHasAuthMode = Pick<User, "auth_mode"> extends { auth_mode?: string | null } ? true : false

type SessionUser = Session["user"]
type SessionUserHasId = Pick<SessionUser, "id"> extends { id: string } ? true : false
type SessionUserHasUsername = Pick<SessionUser, "username"> extends { username: string } ? true : false
type SessionUserHasRole = Pick<SessionUser, "role"> extends { role: string } ? true : false
type SessionUserHasKhoaPhong = Pick<SessionUser, "khoa_phong"> extends { khoa_phong?: string | null } ? true : false
type SessionUserHasDonVi = Pick<SessionUser, "don_vi"> extends { don_vi?: string | number | null } ? true : false
type SessionUserHasCurrentDonVi = Pick<SessionUser, "current_don_vi"> extends { current_don_vi?: number | null } ? true : false
type SessionUserHasDiaBanId = Pick<SessionUser, "dia_ban_id"> extends { dia_ban_id?: string | number | null } ? true : false
type SessionUserHasDiaBanMa = Pick<SessionUser, "dia_ban_ma"> extends { dia_ban_ma?: string | null } ? true : false
type SessionUserHasFullName = Pick<SessionUser, "full_name"> extends { full_name?: string | null } ? true : false
type SessionUserHasAuthMode = Pick<SessionUser, "auth_mode"> extends { auth_mode?: string | null } ? true : false
type SessionHasPendingSignoutReason = Pick<Session, "pending_signout_reason"> extends { pending_signout_reason?: string | null } ? true : false

type JwtHasId = Pick<JWT, "id"> extends { id?: string } ? true : false
type JwtHasUsername = Pick<JWT, "username"> extends { username?: string } ? true : false
type JwtHasRole = Pick<JWT, "role"> extends { role?: string } ? true : false
type JwtHasKhoaPhong = Pick<JWT, "khoa_phong"> extends { khoa_phong?: string | null } ? true : false
type JwtHasDonVi = Pick<JWT, "don_vi"> extends { don_vi?: string | number | null } ? true : false
type JwtHasCurrentDonVi = Pick<JWT, "current_don_vi"> extends { current_don_vi?: number | null } ? true : false
type JwtHasDiaBanId = Pick<JWT, "dia_ban_id"> extends { dia_ban_id?: string | number | null } ? true : false
type JwtHasDiaBanMa = Pick<JWT, "dia_ban_ma"> extends { dia_ban_ma?: string | null } ? true : false
type JwtHasFullName = Pick<JWT, "full_name"> extends { full_name?: string | null } ? true : false
type JwtHasAuthMode = Pick<JWT, "auth_mode"> extends { auth_mode?: string | null } ? true : false
type JwtHasLoginTime = Pick<JWT, "loginTime"> extends { loginTime?: number } ? true : false
type JwtHasLastRefreshAt = Pick<JWT, "lastRefreshAt"> extends { lastRefreshAt?: number } ? true : false
type JwtHasPendingSignoutReason = Pick<JWT, "pending_signout_reason"> extends { pending_signout_reason?: string | null } ? true : false

type _userHasId = Assert<UserHasId>
type _userHasUsername = Assert<UserHasUsername>
type _userHasRole = Assert<UserHasRole>
type _userHasKhoaPhong = Assert<UserHasKhoaPhong>
type _userHasDonVi = Assert<UserHasDonVi>
type _userHasCurrentDonVi = Assert<UserHasCurrentDonVi>
type _userHasDiaBanId = Assert<UserHasDiaBanId>
type _userHasDiaBanMa = Assert<UserHasDiaBanMa>
type _userHasFullName = Assert<UserHasFullName>
type _userHasAuthMode = Assert<UserHasAuthMode>

type _sessionUserHasId = Assert<SessionUserHasId>
type _sessionUserHasUsername = Assert<SessionUserHasUsername>
type _sessionUserHasRole = Assert<SessionUserHasRole>
type _sessionUserHasKhoaPhong = Assert<SessionUserHasKhoaPhong>
type _sessionUserHasDonVi = Assert<SessionUserHasDonVi>
type _sessionUserHasCurrentDonVi = Assert<SessionUserHasCurrentDonVi>
type _sessionUserHasDiaBanId = Assert<SessionUserHasDiaBanId>
type _sessionUserHasDiaBanMa = Assert<SessionUserHasDiaBanMa>
type _sessionUserHasFullName = Assert<SessionUserHasFullName>
type _sessionUserHasAuthMode = Assert<SessionUserHasAuthMode>
type _sessionHasPendingSignoutReason = Assert<SessionHasPendingSignoutReason>

type _jwtHasId = Assert<JwtHasId>
type _jwtHasUsername = Assert<JwtHasUsername>
type _jwtHasRole = Assert<JwtHasRole>
type _jwtHasKhoaPhong = Assert<JwtHasKhoaPhong>
type _jwtHasDonVi = Assert<JwtHasDonVi>
type _jwtHasCurrentDonVi = Assert<JwtHasCurrentDonVi>
type _jwtHasDiaBanId = Assert<JwtHasDiaBanId>
type _jwtHasDiaBanMa = Assert<JwtHasDiaBanMa>
type _jwtHasFullName = Assert<JwtHasFullName>
type _jwtHasAuthMode = Assert<JwtHasAuthMode>
type _jwtHasLoginTime = Assert<JwtHasLoginTime>
type _jwtHasLastRefreshAt = Assert<JwtHasLastRefreshAt>
type _jwtHasPendingSignoutReason = Assert<JwtHasPendingSignoutReason>
