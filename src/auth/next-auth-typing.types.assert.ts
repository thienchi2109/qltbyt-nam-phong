import type { Session, User } from "next-auth"
import type { JWT } from "next-auth/jwt"

type Assert<T extends true> = T

type UserHasId = User extends { id: string } ? true : false
type UserHasUsername = User extends { username: string } ? true : false
type UserHasRole = User extends { role: string } ? true : false
type UserHasKhoaPhong = User extends { khoa_phong?: string | null } ? true : false
type UserHasDonVi = User extends { don_vi?: string | number | null } ? true : false
type UserHasCurrentDonVi = User extends { current_don_vi?: number | null } ? true : false
type UserHasDiaBanId = User extends { dia_ban_id?: string | number | null } ? true : false
type UserHasDiaBanMa = User extends { dia_ban_ma?: string | null } ? true : false
type UserHasFullName = User extends { full_name?: string | null } ? true : false
type UserHasAuthMode = User extends { auth_mode?: string | null } ? true : false

type SessionUser = Session["user"]
type SessionUserHasId = SessionUser extends { id: string } ? true : false
type SessionUserHasUsername = SessionUser extends { username: string } ? true : false
type SessionUserHasRole = SessionUser extends { role: string } ? true : false
type SessionUserHasKhoaPhong = SessionUser extends { khoa_phong?: string | null } ? true : false
type SessionUserHasDonVi = SessionUser extends { don_vi?: string | number | null } ? true : false
type SessionUserHasCurrentDonVi = SessionUser extends { current_don_vi?: number | null } ? true : false
type SessionUserHasDiaBanId = SessionUser extends { dia_ban_id?: string | number | null } ? true : false
type SessionUserHasDiaBanMa = SessionUser extends { dia_ban_ma?: string | null } ? true : false
type SessionUserHasFullName = SessionUser extends { full_name?: string | null } ? true : false

type JwtHasId = JWT extends { id?: string } ? true : false
type JwtHasUsername = JWT extends { username?: string } ? true : false
type JwtHasRole = JWT extends { role?: string } ? true : false
type JwtHasKhoaPhong = JWT extends { khoa_phong?: string | null } ? true : false
type JwtHasDonVi = JWT extends { don_vi?: string | number | null } ? true : false
type JwtHasCurrentDonVi = JWT extends { current_don_vi?: number | null } ? true : false
type JwtHasDiaBanId = JWT extends { dia_ban_id?: string | number | null } ? true : false
type JwtHasDiaBanMa = JWT extends { dia_ban_ma?: string | null } ? true : false
type JwtHasFullName = JWT extends { full_name?: string | null } ? true : false
type JwtHasAuthMode = JWT extends { auth_mode?: string | null } ? true : false
type JwtHasLoginTime = JWT extends { loginTime?: number } ? true : false

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
